import { FC, useEffect, useState, useCallback, useContext } from "react";
import { Modal } from "../ReusableComponents/Modal";
import { ActiveTabs, Tabs } from "../ReusableComponents/ActiveTabs";
import { getAllUserMtdCosts, getBillingGroupsCosts, getAllUserMtdCostsRecursive, AutoLoadProgress, getUserCostHistory, UserCostHistory, MonthlyHistoryData } from "@/services/mtdCostService";
import { normalizeRateLimits, formatRateLimits } from "@/types/rateLimit";
import { LoadingIcon } from "../Loader/LoadingIcon";
import { IconRefresh, IconDownload, IconUsers, IconBuilding, IconLink, IconAlertTriangle, IconInfoCircle, IconKey, IconUserCog, IconBolt, IconShieldX, IconGauge } from "@tabler/icons-react";
import { InfoBox } from "../ReusableComponents/InfoBox";
import React from "react";
import Search from "../Search/Search";
import { formatCurrency } from "@/utils/app/data";
import HomeContext from "@/pages/api/home/home.context";

interface AccountData {
  accountInfo: string;
  dailyCost: number;
  monthlyCost: number;
  totalCost: number;
  timestamp?: string;
}

interface UserMtdData {
  email: string;
  dailyCost: number;
  monthlyCost: number;
  totalCost: number;
  accounts: AccountData[];
  lastUpdated?: string;
  membershipType?: 'direct' | 'indirect';
  via?: string | null;
  path?: string[];
}

interface UserCostsResponse {
  users: UserMtdData[];
  count: number;
  lastEvaluatedKey: any;
  hasMore: boolean;
}

interface GroupInfo {
  name: string;
  createdBy: string;
  rateLimit: {
    daily: number;
    monthly: number;
  };
  directMemberCount: number;
  indirectMemberCount: number;
  totalMemberCount: number;
}

interface GroupCosts {
  total: number;
  daily: number;
  monthly: number;
  avgPerMember: number;
}

interface GroupMembers {
  all: UserMtdData[];
  direct: UserMtdData[];
  indirect: UserMtdData[];
  topSpenders: UserMtdData[];
}

interface BillingGroup {
  groupInfo: GroupInfo;
  costs: GroupCosts;
  members: GroupMembers;
}

interface BillingGroupsResponse {
  billingGroups: Record<string, BillingGroup>;
  summary: {
    totalBillingGroups: number;
    totalUsers: number;
    totalCost: number;
    timestamp: string;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
}


export const UserCostsModal: FC<Props> = ({ open, onClose }) => {
  const { state: {amplifyUsers, adminRateLimits}, dispatch: homeDispatch } = useContext(HomeContext);
  const [activeTab, setActiveTab] = useState(0);
  
  // All Users tab state
  const [userCosts, setUserCosts] = useState<UserMtdData[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  
  // Auto-load state
  const [autoLoadState, setAutoLoadState] = useState<{
    status: 'idle' | 'loading' | 'completed' | 'error' | 'aborted';
    loadedCount: number;
    currentTotalCost: number;
    batchNumber: number;
    hasMore: boolean;
  }>({
    status: 'idle',
    loadedCount: 0,
    currentTotalCost: 0,
    batchNumber: 0,
    hasMore: false
  });
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // History state
  const [userHistory, setUserHistory] = useState<Record<string, UserCostHistory>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});
  const [expandedMonth, setExpandedMonth] = useState<Record<string, string | null>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  
  // Search state
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [groupSearchTerm, setGroupSearchTerm] = useState<string>('');
  
  // Billing Groups tab state
  const [billingGroups, setBillingGroups] = useState<Record<string, BillingGroup>>({});
  const [groupsSummary, setGroupsSummary] = useState<BillingGroupsResponse['summary'] | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [expandedGroupMembers, setExpandedGroupMembers] = useState<string | null>(null);
  const [groupsSortBy, setGroupsSortBy] = useState<'cost' | 'name' | 'rateLimit'>('cost');
  const [showAtRiskFirst, setShowAtRiskFirst] = useState(false);

  // Rate Limits tab state
  const [rateLimitSearch, setRateLimitSearch] = useState<string>('');
  const [expandedRateLimitUser, setExpandedRateLimitUser] = useState<string | null>(null);

  // Auto-load All Users MTD costs with progressive rendering
  const autoLoadAllUsers = useCallback(async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setUserLoading(true);
    setUserError(null);
    setUserCosts([]);
    setAutoLoadState({
      status: 'loading',
      loadedCount: 0,
      currentTotalCost: 0,
      batchNumber: 0,
      hasMore: true
    });

    const handleProgress = (progress: AutoLoadProgress) => {
      // Create a new array reference to ensure React detects the change
      setUserCosts([...progress.users]);
      setAutoLoadState({
        status: progress.isComplete ? 'completed' : 'loading',
        loadedCount: progress.loadedCount,
        currentTotalCost: progress.currentTotalCost,
        batchNumber: progress.batchNumber,
        hasMore: progress.hasMore
      });
    };

    try {
      const result = await getAllUserMtdCostsRecursive(
        handleProgress,
        controller.signal,
        100
      );

      if (!result.success) {
        setUserError(result.message || 'Failed to fetch MTD costs');
        setAutoLoadState(prev => ({ ...prev, status: 'error' }));
      } else if (result.data?.aborted) {
        setAutoLoadState(prev => ({ ...prev, status: 'aborted' }));
      } else {
        setAutoLoadState(prev => ({ ...prev, status: 'completed' }));
      }
    } catch (err) {
      setUserError('An error occurred while fetching MTD costs');
      console.error('Error fetching MTD costs:', err);
      setAutoLoadState(prev => ({ ...prev, status: 'error' }));
    } finally {
      setUserLoading(false);
      setAbortController(null);
    }
  }, []);

  // Fetch Billing Groups costs
  const fetchBillingGroupsCosts = async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    
    try {
      const result = await getBillingGroupsCosts();
      // console.log("billing groups result", result.data);
      if (!result.success || !result.data) {
        setGroupsError(result.message || 'Failed to fetch billing groups costs');
        return;
      }
      
      const data = result.data;
      if (data && data.billingGroups) {
        setBillingGroups(data.billingGroups);
        setGroupsSummary(data.summary);
      }
    } catch (err) {
      setGroupsError('An error occurred while fetching billing groups costs');
      console.error('Error fetching billing groups costs:', err);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      autoLoadAllUsers();
      fetchBillingGroupsCosts();
    }
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [open]);

  const handleStopLoading = () => {
    if (abortController) {
      abortController.abort();
      setAutoLoadState(prev => ({ ...prev, status: 'aborted', hasMore: false }));
    }
  };


  // Function to clean group emails and detect if it's a group
  const cleanEmailDisplay = (email: string) => {
    // Check if email matches pattern: groupName_uuid
    const groupPattern = /^(.+)_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    const match = email.match(groupPattern);
    
    if (match) {
      // It's a group email, return cleaned name and mark as group
      return {
        displayName: match[1], // Group name without UUID
        isGroup: true,
        originalEmail: email
      };
    }
    
    // It's a regular user email
    return {
      displayName: email,
      isGroup: false,
      originalEmail: email
    };
  };

  // Function to detect system users (ending with -<6randomnums>)
  const isSystemUser = (email: string) => {
    // Check if email ends with dash followed by 6 random numbers
    const systemUserPattern = /-\d{6}$/;
    return systemUserPattern.test(email);
  };

  // Function to get display name from amplifyUsers mapping
  const getUserDisplayName = (email: string) => {
    // If email exists in amplifyUsers mapping, return the mapped value
    if (amplifyUsers && amplifyUsers[email]) {
      return amplifyUsers[email];
    }
    // Otherwise return the original email
    return email;
  };

  // Filter users based on search term and sort by total cost (highest to lowest)
  // Using useMemo to ensure sorting happens reactively when userCosts changes
  const filteredUsers = React.useMemo(() => {
    return userCosts
      .filter((user) => {
        if (!userSearchTerm.trim()) return true;
        const searchLower = userSearchTerm.toLowerCase();
        const emailInfo = cleanEmailDisplay(user.email);
        const displayName = getUserDisplayName(user.email);
        return (
          user.email.toLowerCase().includes(searchLower) ||
          emailInfo.displayName.toLowerCase().includes(searchLower) ||
          displayName.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [userCosts, userSearchTerm]);

  // Rate limit helpers
  const getRateLimitStatus = (cost: number, limit: number | undefined): { status: 'green' | 'yellow' | 'orange' | 'red' | 'unlimited'; percentage: number; label: string; color: string; bgColor: string; textColor: string } => {
    if (!limit || limit === 0) {
      return { status: 'unlimited', percentage: 0, label: 'No limit set', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400' };
    }
    const pct = (cost / limit) * 100;
    if (pct > 100) return { status: 'red', percentage: pct, label: 'Limit exceeded', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-600 dark:text-red-400' };
    if (pct >= 96) return { status: 'red', percentage: pct, label: 'At limit', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-600 dark:text-red-400' };
    if (pct >= 81) return { status: 'orange', percentage: pct, label: 'Close to limit', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-600 dark:text-orange-400' };
    if (pct >= 61) return { status: 'yellow', percentage: pct, label: 'Approaching limit', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-600 dark:text-amber-400' };
    return { status: 'green', percentage: pct, label: 'Well within limit', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-600 dark:text-green-400' };
  };

  const getGroupWorstRateLimitStatus = (group: BillingGroup) => {
    const dailyStatus = getRateLimitStatus(group.costs.daily, group.groupInfo.rateLimit?.daily);
    const monthlyStatus = getRateLimitStatus(group.costs.monthly, group.groupInfo.rateLimit?.monthly);
    
    const statusPriority: Record<string, number> = { red: 4, orange: 3, yellow: 2, green: 1, unlimited: 0 };
    return statusPriority[dailyStatus.status] >= statusPriority[monthlyStatus.status] ? dailyStatus : monthlyStatus;
  };

  // Filter billing groups based on search term
  const filteredBillingGroups = Object.entries(billingGroups).filter(([groupName, group]) => {
    if (!groupSearchTerm.trim()) return true;
    const searchLower = groupSearchTerm.toLowerCase();
    return (
      groupName.toLowerCase().includes(searchLower) ||
      group.groupInfo.createdBy.toLowerCase().includes(searchLower)
    );
  }).sort(([nameA, groupA], [nameB, groupB]) => {
    if (showAtRiskFirst) {
      const statusA = getGroupWorstRateLimitStatus(groupA);
      const statusB = getGroupWorstRateLimitStatus(groupB);
      const statusPriority: Record<string, number> = { red: 5, orange: 4, yellow: 3, green: 2, unlimited: 1 };
      const statusDiff = statusPriority[statusA.status] - statusPriority[statusB.status];
      if (statusDiff !== 0) return -statusDiff;
    }
    
    if (groupsSortBy === 'name') {
      return nameA.localeCompare(nameB);
    } else if (groupsSortBy === 'rateLimit') {
      const statusA = getGroupWorstRateLimitStatus(groupA);
      const statusB = getGroupWorstRateLimitStatus(groupB);
      return statusB.percentage - statusA.percentage;
    }
    return groupB.costs.total - groupA.costs.total;
  });

  const formatAccountInfo = (accountInfo: string) => {
    // Split by # to separate account name and API key info
    const parts = accountInfo.split('#');
    const [accountName, apiKeyInfo] = parts;
    
    let apiComponent = null;
    
    // Handle new API key format with key types
    if (apiKeyInfo && (apiKeyInfo.includes('/ownerKey/') || apiKeyInfo.includes('/delegateKey/') || apiKeyInfo.includes('/systemKey/'))) {
      // Determine key type and colors
      let keyType = 'personal';
      let iconColor = '#9ca3af'; // gray-400
      let textColor = 'text-gray-500';
      let keyTypeLabel = 'Personal';
      let KeyIcon = IconKey;
      
      if (apiKeyInfo.includes('/systemKey/')) {
        keyType = 'system';
        iconColor = '#16a34a'; // green-600
        textColor = 'text-green-600';
        keyTypeLabel = 'System';
      } else if (apiKeyInfo.includes('/delegateKey/')) {
        keyType = 'delegate';
        iconColor = '#f59e0b'; // amber-500
        textColor = 'text-amber-500';
        keyTypeLabel = 'Delegate';
      } else if (apiKeyInfo.includes('/ownerKey/') && /_account(\s|$)/.test(accountName)) {
        // Agent key - personal key with agent account.
        // The account label may have a friendly app name appended, e.g.
        // "scheduled_task_account (New Worfflow)", so we match "_account"
        // whether it ends the string or is followed by the parenthetical name.
        keyType = 'agent';
        iconColor = '#8b5cf6'; // purple-500
        textColor = 'text-purple-500';
        keyTypeLabel = 'Agent';
        KeyIcon = IconBolt;
      }
      
      apiComponent = (
        <div className="flex flex-row gap-2 items-center">
          <span className="font-mono text-xs text-blue-500">API Key:</span>
          <div className="flex items-center gap-1">
            <KeyIcon size={15} style={{ color: iconColor }} />
            <span className={`text-xs font-semibold ${textColor}`}>
              {keyTypeLabel}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
              {apiKeyInfo}
            </span>
          </div>
        </div>
      );
    } else if (apiKeyInfo && apiKeyInfo !== 'NA') {
      // Handle other formats or fallback
      apiComponent = (
        <div className="flex flex-row gap-2">
          <span className="font-mono text-xs text-blue-500">API Info:</span>
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
            {apiKeyInfo}
          </span>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs">Account: {accountName}</span>
        {apiComponent}
      </div>
    );
  };

  const handleRefresh = () => {
    if (activeTab === 0) {
      autoLoadAllUsers();
    } else if (activeTab === 1) {
      fetchBillingGroupsCosts();
    } else {
      autoLoadAllUsers();
    }
  };

  const toggleUserExpansion = (email: string) => {
    const wasExpanded = expandedUser === email;
    setExpandedUser(wasExpanded ? null : email);
  };
  
  const loadHistoryForUser = async (email: string) => {
    if (userHistory[email]) {
      // Already loaded, just toggle visibility
      setShowHistory(prev => ({ ...prev, [email]: !prev[email] }));
      return;
    }
    
    setLoadingHistory(prev => ({ ...prev, [email]: true }));
    setShowHistory(prev => ({ ...prev, [email]: true }));
    
    const result = await getUserCostHistory(email, 12);
    
    if (result.success && result.data) {
      setUserHistory(prev => ({ ...prev, [email]: result.data }));
    }
    
    setLoadingHistory(prev => ({ ...prev, [email]: false }));
  };

  const toggleGroupMembersExpansion = (groupName: string) => {
    setExpandedGroupMembers(expandedGroupMembers === groupName ? null : groupName);
  };

  // CSV Download functions
  const downloadUsersCSV = () => {
    const headers = ['Email', 'Today\'s Cost', 'Monthly Cost', 'Total Cost', 'Accounts Count'];
    const csvContent = [
      headers.join(','),
      ...filteredUsers.map(user => [
        getUserDisplayName(user.email),
        user.dailyCost.toFixed(2),
        user.monthlyCost.toFixed(2),
        user.totalCost.toFixed(2),
        user.accounts?.length || 0
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-costs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadGroupsCSV = () => {
    const headers = ['Group Name', 'Total Cost', 'Today\'s Cost', 'Monthly Cost', 'Direct Members', 'Indirect Members', 'Total Members', 'Avg Cost Per Member'];
    const csvContent = [
      headers.join(','),
      ...Object.entries(billingGroups)
        .sort(([, a], [, b]) => b.costs.total - a.costs.total)
        .map(([groupName, group]) => [
        groupName,
        group.costs.total.toFixed(2),
        group.costs.daily.toFixed(2),
        group.costs.monthly.toFixed(2),
        group.groupInfo.directMemberCount,
        group.groupInfo.indirectMemberCount,
        group.groupInfo.totalMemberCount,
        group.costs.avgPerMember.toFixed(2),
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-groups-costs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadUserHistoryCSV = (email: string, user: UserMtdData) => {
    const history = userHistory[email];
    if (!history) return;

    const headers = ['Month', 'Account', 'Today\'s Cost', 'Monthly Cost', 'Total Cost'];
    const rows: string[] = [headers.join(',')];

    // Add current month data first
    const currentMonth = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (user.accounts && user.accounts.length > 0) {
      user.accounts.forEach(account => {
        // Clean account info for CSV (remove formatting characters)
        const accountName = account.accountInfo.split('#')[0];
        rows.push([
          `"${currentMonth} (Current)"`,
          `"${accountName}"`,
          account.dailyCost.toFixed(2),
          account.monthlyCost.toFixed(2),
          account.totalCost.toFixed(2)
        ].join(','));
      });
    }

    // Add historical months data
    if (history.history && history.history.length > 0) {
      history.history.forEach(month => {
        month.accounts.forEach(account => {
          const accountName = account.accountInfo.split('#')[0];
          rows.push([
            `"${month.displayMonth}"`,
            `"${accountName}"`,
            '0.00', // Historical data doesn't split daily/monthly
            '0.00',
            account.cost.toFixed(2)
          ].join(','));
        });
      });
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const displayName = getUserDisplayName(email);
    const filename = displayName.includes('@') ? displayName.split('@')[0] : displayName;
    a.download = `${filename}-cost-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Helper function to find duplicate members across groups
  const findDuplicateMembers = () => {
    const userGroups: Record<string, string[]> = {};
    
    Object.entries(billingGroups).forEach(([groupName, group]) => {
      const allMembers = [...group.members.direct, ...group.members.indirect];
      allMembers.forEach(member => {
        if (!userGroups[member.email]) {
          userGroups[member.email] = [];
        }
        userGroups[member.email].push(groupName);
      });
    });
    
    return userGroups;
  };

  const duplicateMembers = findDuplicateMembers();

  // Get groups at risk (80%+ of rate limit)
  const atRiskGroups = Object.entries(billingGroups).filter(([_, group]) => {
    const dailyStatus = getRateLimitStatus(group.costs.daily, group.groupInfo.rateLimit?.daily);
    const monthlyStatus = getRateLimitStatus(group.costs.monthly, group.groupInfo.rateLimit?.monthly);
    return (dailyStatus.percentage >= 80 && dailyStatus.status !== 'unlimited') || 
           (monthlyStatus.percentage >= 80 && monthlyStatus.status !== 'unlimited');
  });

  // Helper function to check if a user is in multiple groups
  const isUserInMultipleGroups = (email: string) => {
    return duplicateMembers[email]?.length > 1;
  };

  // Helper function to get other groups for a user
  const getOtherGroups = (email: string, currentGroup: string) => {
    return duplicateMembers[email]?.filter(group => group !== currentGroup) || [];
  };

  // Render helper for different duplicate member highlighting options
  const renderMemberWithDuplicateHighlight = (user: UserMtdData, currentGroup: string, index: number, isDirect: boolean) => {
    const isDuplicate = isUserInMultipleGroups(user.email);
    const otherGroups = getOtherGroups(user.email, currentGroup);
    const groupCount = duplicateMembers[user.email]?.length || 1;
    
    const baseClasses = `text-xs p-2 rounded transition-all ${
      isDirect 
        ? 'bg-blue-50 dark:bg-blue-900/20' 
        : 'bg-purple-50 dark:bg-purple-900/20'
    }`;

    // OPTION 1: Badge with chain link icon
    const renderOption1 = () => (
      <div key={index} className={`${baseClasses} ${isDuplicate ? 'ring-2 ring-amber-300 dark:ring-amber-600' : ''}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <span className="text-gray-900 dark:text-white break-all">
              {getUserDisplayName(user.email)}
            </span>
            {isDuplicate && (
              <div className="flex items-center space-x-1 flex-shrink-0">
                <IconLink size={12} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  +{groupCount - 1}
                </span>
              </div>
            )}
          </div>
          <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0 ml-2">
            {formatCurrency(user.totalCost)}
          </span>
        </div>
        {user.via && (
          <div className="text-purple-600 dark:text-purple-400 mt-1 break-all">
            ↳ via: {user.via}
          </div>
        )}
        {isDuplicate && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 break-all">
            Also in: {otherGroups.slice(0, 2).join(', ')}{otherGroups.length > 2 ? '...' : ''}
          </div>
        )}
      </div>
    );

    // OPTION 2: Warning color coding
    const renderOption2 = () => (
      <div key={index} className={`${baseClasses} ${isDuplicate ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600' : ''}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {isDuplicate && <IconAlertTriangle size={12} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />}
            <span className="text-gray-900 dark:text-white break-all">
              {getUserDisplayName(user.email)}
            </span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0 ml-2">
            {formatCurrency(user.totalCost)}
          </span>
        </div>
        {user.via && (
          <div className="text-purple-600 dark:text-purple-400 mt-1 break-all">
            ↳ via: {user.via}
          </div>
        )}
      </div>
    );

    // OPTION 3: Counter badge
    const renderOption3 = () => (
      <div key={index} className={baseClasses}>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <span className="text-gray-900 dark:text-white break-all">
              {getUserDisplayName(user.email)}
            </span>
            {isDuplicate && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex-shrink-0">
                {groupCount}x
              </span>
            )}
          </div>
          <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0 ml-2">
            {formatCurrency(user.totalCost)}
          </span>
        </div>
        {user.via && (
          <div className="text-purple-600 dark:text-purple-400 mt-1 break-all">
            ↳ via: {user.via}
          </div>
        )}
      </div>
    );

    // OPTION 4: Striped background pattern
    const renderOption4 = () => (
      <div 
        key={index} 
        className={`${baseClasses} ${isDuplicate ? 'bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-900/20 dark:via-gray-800 dark:to-amber-900/20' : ''}`}
        style={isDuplicate ? {
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(245, 158, 11, 0.1) 2px, rgba(245, 158, 11, 0.1) 4px)'
        } : {}}
      >
        <div className="flex justify-between items-center">
          <span className="text-gray-900 dark:text-white break-all flex-1 min-w-0">
            {getUserDisplayName(user.email)}
          </span>
          <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0 ml-2">
            {formatCurrency(user.totalCost)}
          </span>
        </div>
        {user.via && (
          <div className="text-purple-600 dark:text-purple-400 mt-1 break-all">
            ↳ via: {user.via}
          </div>
        )}
      </div>
    );

    // OPTION 5: Tooltip approach (would need additional tooltip component)
    const renderOption5 = () => (
      <div 
        key={index} 
        className={`${baseClasses} ${isDuplicate ? 'cursor-help' : ''}`}
        title={isDuplicate ? `This user appears in ${groupCount} groups: ${duplicateMembers[user.email].join(', ')}` : ''}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <span className="text-gray-900 dark:text-white break-all">
              {getUserDisplayName(user.email)}
            </span>
            {isDuplicate && (
              <IconInfoCircle size={12} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
            )}
          </div>
          <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0 ml-2">
            {formatCurrency(user.totalCost)}
          </span>
        </div>
        {user.via && (
          <div className="text-purple-600 dark:text-purple-400 mt-1 break-all">
            ↳ via: {user.via}
          </div>
        )}
      </div>
    );

    // CHANGE THIS LINE TO TEST DIFFERENT OPTIONS:
    // return renderOption1(); // 🔗 Badge with chain link icon + group list
    // return renderOption2(); // ⚠️ Warning color coding with alert icon  
    // return renderOption3(); // 💊 Counter badge showing "2x", "3x", etc.
    // return renderOption4(); // 🎨 Striped background pattern
    // return renderOption5(); // 💡 Tooltip with info icon (hover for details)
    
    return renderOption1(); // Current selection
  };

  // Calculate summary stats for users (always use original data, not filtered)
  const usersSummary = {
    totalUsers: userCosts.length,
    totalCost: userCosts.reduce((sum, user) => sum + user.totalCost, 0),
    // Avg Cost/User excludes $0 users (only averages over users who actually incurred cost)
    avgCostPerUser: (() => {
      const payingUsers = userCosts.filter((user) => user.totalCost > 0);
      return payingUsers.length > 0
        ? payingUsers.reduce((sum, user) => sum + user.totalCost, 0) / payingUsers.length
        : 0;
    })(),
    // Only calculate top spender from complete data to avoid showing wrong user during progressive loading
    topSpender: (userCosts.length > 0 && autoLoadState.status === 'completed')
      ? userCosts.reduce((prev, current) => (prev.totalCost > current.totalCost) ? prev : current)
      : null,
    // Keep track of filtered counts for display purposes
    filteredTotalUsers: filteredUsers.length,
    isLoadingComplete: autoLoadState.status === 'completed' || autoLoadState.status === 'aborted'
  };

  const renderAllUsersTab = () => (
    <div className="flex flex-col h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 px-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <IconUsers className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{usersSummary.totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 text-lg font-bold">$</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cost</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(usersSummary.totalCost)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">MTD</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 text-lg font-bold">Ø</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Cost/User</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(usersSummary.avgCostPerUser)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <span className="text-red-600 dark:text-red-400 text-lg font-bold">🏆</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Spender</p>
              <div className="flex items-center space-x-1 max-w-[120px]">
                {(() => {
                  if (!usersSummary.isLoadingComplete && autoLoadState.status === 'loading') {
                    return <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>;
                  }
                  if (!usersSummary.topSpender) return <span className="text-sm font-semibold text-gray-900 dark:text-white">N/A</span>;

                  const emailInfo = cleanEmailDisplay(usersSummary.topSpender.email);
                  const isSystem = isSystemUser(usersSummary.topSpender.email);
                  return (
                    <>
                      {emailInfo.isGroup && (
                        <IconUsers size={14} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      )}
                      {isSystem && (
                        <IconUserCog size={14} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {emailInfo.isGroup ? emailInfo.displayName : getUserDisplayName(usersSummary.topSpender.email).split('@')[0]}
                      </p>
                    </>
                  );
                })()}
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                {!usersSummary.isLoadingComplete && autoLoadState.status === 'loading'
                  ? '...'
                  : usersSummary.topSpender ? formatCurrency(usersSummary.topSpender.totalCost) : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Auto-Loading Banner */}
      {autoLoadState.status === 'loading' && (
        <div className="mb-4 mx-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <LoadingIcon style={{ width: '20px', height: '20px' }} />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Loading users...
                  </span>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {autoLoadState.loadedCount.toLocaleString()} loaded
                  </span>
                  <span className="text-blue-400 dark:text-blue-500">•</span>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    {formatCurrency(autoLoadState.currentTotalCost)} so far
                  </span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Batch {autoLoadState.batchNumber} • Fetching all users automatically...
                </div>
              </div>
            </div>
            <button
              onClick={handleStopLoading}
              className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md transition-colors"
            >
              Stop Loading
            </button>
          </div>
          <div className="mt-3 w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-2.5 overflow-hidden relative">
            {/* Animated gradient bar */}
            <div className="loading-bar-animated"></div>
          </div>
        </div>
      )}

      {/* Completion Banner */}
      {autoLoadState.status === 'completed' && (
        <div className="mb-4 mx-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
            <span className="text-sm font-medium text-green-900 dark:text-green-200">
              Loaded all {autoLoadState.loadedCount.toLocaleString()} users • Total: {formatCurrency(autoLoadState.currentTotalCost)}
            </span>
          </div>
        </div>
      )}

      {/* Aborted Banner */}
      {autoLoadState.status === 'aborted' && (
        <div className="mb-4 mx-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600 dark:text-yellow-400 text-lg">⏸</span>
            <span className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              Stopped loading • Showing {autoLoadState.loadedCount.toLocaleString()} users • Partial total: {formatCurrency(autoLoadState.currentTotalCost)}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center space-x-4">
          {/* Search Bar - only show if there are multiple users */}
          {userCosts.length > 1 && (
            <div className="px-2">
              <Search
                placeholder="Search users..."
                searchTerm={userSearchTerm}
                onSearch={setUserSearchTerm}
                paddingY="py-2"
              />
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={downloadUsersCSV}
            disabled={userLoading || userCosts.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ opacity: userLoading || userCosts.length === 0? 0.5 : 1 }}
            title="Download CSV"
          >
            <IconDownload size={16} />
            <span>CSV</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={userLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh data"
          >
            {userLoading ? (
              <LoadingIcon style={{ width: '16px', height: '16px' }} />
            ) : (
              <IconRefresh size={16} />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {userError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mx-2">
          <p className="text-red-800 dark:text-red-200">{userError}</p>
        </div>
      )}

      {/* Initial Loading State - only show when no data yet */}
      {userLoading && userCosts.length === 0 && !userError && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <LoadingIcon style={{ width: '24px', height: '24px' }} />
            <span className="text-lg text-gray-700 dark:text-gray-300">Initializing data load...</span>
          </div>
        </div>
      )}

      {/* Data Table - Show even while loading if we have data */}
      {userCosts.length > 0 && !userError && (
        <div className="flex-1 overflow-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mx-2 h-full flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Month to Date Cost by User 
                {userSearchTerm ? (
                  <span>({filteredUsers.length} of {userCosts.length} users)</span>
                ) : autoLoadState.status === 'loading' ? (
                  <span>({userCosts.length.toLocaleString()} loaded, loading more...)</span>
                ) : autoLoadState.status === 'aborted' ? (
                  <span>({userCosts.length.toLocaleString()} partial)</span>
                ) : (
                  <span>({userCosts.length.toLocaleString()} total)</span>
                )}
              </h2>
            </div>
            
            {userCosts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No usage data available</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No users found matching &quot;{userSearchTerm}&quot;</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Today&apos;s Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Monthly Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.map((user, index) => (
                      <React.Fragment key={`${user.email}_${index}`}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            <button
                              onClick={() => toggleUserExpansion(user.email)}
                              className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                              <span>{expandedUser === user.email ? '▼' : '▶'}</span>
                              {(() => {
                                const emailInfo = cleanEmailDisplay(user.email);
                                const isSystem = isSystemUser(user.email);
                                return (
                                  <div className="flex items-center space-x-2">
                                    {emailInfo.isGroup && (
                                      <IconUsers size={16} className="text-purple-600 dark:text-purple-400" />
                                    )}
                                    {isSystem && (
                                      <IconUserCog size={16} className="text-orange-600 dark:text-orange-400" />
                                    )}
                                    <span>{getUserDisplayName(user.email)}</span>
                                  </div>
                                );
                              })()}
                              {user.accounts && user.accounts.length > 1 && (
                                <span className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                                  {user.accounts.length} accounts
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <span className={`font-semibold ${user.dailyCost > 5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {formatCurrency(user.dailyCost)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <span className={`font-semibold ${user.monthlyCost > 10 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {formatCurrency(user.monthlyCost)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <span className={`font-semibold ${user.totalCost > 15 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {formatCurrency(user.totalCost)}
                            </span>
                          </td>
                        </tr>
                        {expandedUser === user.email && (
                          <tr key={`${user.email}-details`} className="bg-gray-50 dark:bg-gray-900">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="ml-6 space-y-4">
                                {/* Current Month Account Breakdown - FIRST */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Current Month Account Breakdown</h4>
                                  {user.accounts && user.accounts.length > 0 && (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Account Info</th>
                                            <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">{"Today's Cost"}</th>
                                            <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Monthly Cost</th>
                                            <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Total Cost</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {[...user.accounts].sort((a, b) => {
                                            const aParts = a.accountInfo.split('#');
                                            const bParts = b.accountInfo.split('#');
                                            const aAccount = aParts[0];
                                            const bAccount = bParts[0];
                                            const aHasKey = !!(aParts[1] && aParts[1] !== 'NA');
                                            const bHasKey = !!(bParts[1] && bParts[1] !== 'NA');
                                            const aIsGeneral = aAccount === 'general_account' && !aHasKey;
                                            const bIsGeneral = bAccount === 'general_account' && !bHasKey;
                                            const aIsAgent = !aIsGeneral && /_account(\s|$)/.test(aAccount);
                                            const bIsAgent = !bIsGeneral && /_account(\s|$)/.test(bAccount);
                                            // 0 = general_account (first)
                                            // 1 = non-API-key rows (plain accounts)
                                            // 2 = API key rows (Personal/Delegate/System)
                                            // 3 = agent _account rows (last)
                                            const aOrder = aIsGeneral ? 0 : aIsAgent ? 3 : aHasKey ? 2 : 1;
                                            const bOrder = bIsGeneral ? 0 : bIsAgent ? 3 : bHasKey ? 2 : 1;
                                            if (aOrder !== bOrder) return aOrder - bOrder;
                                            return b.totalCost - a.totalCost;
                                          }).map((account, accountIndex) => (
                                            <tr key={`${account.accountInfo}-${accountIndex}`} className="border-b border-gray-100 dark:border-gray-800">
                                              <td className="py-2 px-4 text-gray-900 dark:text-white font-mono text-xs">
                                                {formatAccountInfo(account.accountInfo)}
                                              </td>
                                              <td className="py-2 px-4 text-gray-900 dark:text-white">
                                                {formatCurrency(account.dailyCost)}
                                              </td>
                                              <td className="py-2 px-4 text-gray-900 dark:text-white">
                                                {formatCurrency(account.monthlyCost)}
                                              </td>
                                              <td className="py-2 px-4 text-gray-900 dark:text-white font-semibold">
                                                {formatCurrency(account.totalCost)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                {/* View History Button */}
                                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <button
                                    onClick={() => loadHistoryForUser(user.email)}
                                    disabled={loadingHistory[user.email]}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 border border-blue-200 dark:border-blue-800 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="flex items-center justify-center space-x-2">
                                      {loadingHistory[user.email] ? (
                                        <>
                                          <LoadingIcon style={{ width: '16px', height: '16px' }} />
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading cost history...</span>
                                        </>
                                      ) : showHistory[user.email] ? (
                                        <>
                                          <span className="text-gray-400">▼</span>
                                          <span className="text-sm font-medium text-gray-900 dark:text-white">📅 Hide Cost History</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-gray-400">▶</span>
                                          <span className="text-sm font-medium text-gray-900 dark:text-white">📅 View Cost History</span>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                </div>

                                {/* History Section - Only show when toggled */}
                                {showHistory[user.email] && userHistory[user.email] && (
                                  <div className="space-y-4 pt-4">
                                    {userHistory[user.email].summary.monthCount > 0 && (
                                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className="font-semibold text-gray-900 dark:text-white">📊 Cost History Overview</h4>
                                          <button
                                            onClick={() => downloadUserHistoryCSV(user.email, user)}
                                            className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs"
                                            title="Download history CSV"
                                          >
                                            <IconDownload size={14} />
                                            <span>CSV</span>
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                          <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Total ({userHistory[user.email].summary.monthCount} months)</p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(userHistory[user.email].summary.totalSpendAllTime)}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Avg/Month</p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(userHistory[user.email].summary.avgMonthlySpend)}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Trend</p>
                                            <p className={`text-lg font-bold ${userHistory[user.email].summary.trend.direction === 'up' ? 'text-red-600 dark:text-red-400' : userHistory[user.email].summary.trend.direction === 'down' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                              {userHistory[user.email].summary.trend.direction === 'up' ? '↗' : userHistory[user.email].summary.trend.direction === 'down' ? '↘' : '→'} {userHistory[user.email].summary.trend.percentage.toFixed(1)}%
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {userHistory[user.email].history.length > 0 ? (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">📅 Monthly Breakdown</h4>
                                        <div className="space-y-2">
                                          {userHistory[user.email].history.map((month) => (
                                            <div key={month.month} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                              <button
                                                onClick={() => {
                                                  setExpandedMonth(prev => ({
                                                    ...prev,
                                                    [user.email]: prev[user.email] === month.month ? null : month.month
                                                  }));
                                                }}
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                              >
                                                <div className="flex items-center space-x-3">
                                                  <span className="text-gray-400">{expandedMonth[user.email] === month.month ? '▼' : '▶'}</span>
                                                  <div className="text-left">
                                                    <p className="font-medium text-gray-900 dark:text-white">{month.displayMonth}</p>
                                                    
                                                  </div>
                                                </div>
                                                
                                                <div className="flex items-center space-x-4">
                                                  <span className="font-bold text-lg text-gray-900 dark:text-white">{formatCurrency(month.totalCost)}</span>
                                                  
                                                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div 
                                                      className="bg-blue-600 dark:bg-blue-400 h-full rounded-full transition-all"
                                                      style={{ width: `${Math.min((month.totalCost / Math.max(...userHistory[user.email].history.map(h => h.totalCost))) * 100, 100)}%` }}
                                                    />
                                                  </div>
                                                  
                                                  <span className="text-xs text-gray-600 dark:text-gray-400">{month.accounts.length} accounts</span>
                                                </div>
                                              </button>

                                              {expandedMonth[user.email] === month.month && (
                                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                                  <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                                    Account Breakdown ({month.accounts.length} accounts)
                                                  </h5>
                                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                                    {month.accounts.map((account, idx) => (
                                                      <div key={idx} className="py-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                                        <div className="flex justify-between items-start">
                                                          <div className="text-gray-900 dark:text-white font-mono text-xs flex-1">
                                                            {formatAccountInfo(account.accountInfo)}
                                                          </div>
                                                          <span className="font-semibold text-gray-900 dark:text-white text-sm ml-4">
                                                            {formatCurrency(account.cost)}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        No historical data available for this user
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Skeleton Loaders - Show while loading more batches */}
            {autoLoadState.status === 'loading' && autoLoadState.loadedCount > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderBillingGroupsTab = () => (
    <div className="flex flex-col h-full">
      {/* Summary Cards */}
      {groupsSummary && (
        <div className="grid grid-cols-4 gap-4 mb-6 px-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <IconBuilding className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Groups</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{groupsSummary.totalBillingGroups}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <IconUsers className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{groupsSummary.totalUsers}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 text-lg font-bold">$</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Cost</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(groupsSummary.totalCost)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center">
                <span className="text-amber-600 dark:text-amber-400 text-lg font-bold">💰</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Highest Spending</p>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {(() => {
                    const maxCost = Math.max(...Object.values(billingGroups).map(g => g.costs.total));
                    const topGroups = Object.entries(billingGroups)
                      .filter(([_, group]) => group.costs.total === maxCost)
                      .map(([name, _]) => name);
                    
                    if (topGroups.length === 0) return 'N/A';
                    if (topGroups.length === 1) return topGroups[0];
                    
                    // Handle ties - display in a row with separators
                    return topGroups.join(' • ');
                  })()}
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {Object.entries(billingGroups).length > 0 
                    ? `${formatCurrency(Math.max(...Object.values(billingGroups).map(g => g.costs.total)))}`
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel for Cost Allocation */}
      <InfoBox
        content={<div className="flex flex-col gap-2">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1 text-center">
          Cost Allocation Method
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          User costs are allocated to each billing group they belong to. Members in multiple groups will show highlighted with <span className="font-medium">duplicate indicators</span> since their total spending is counted toward each group&apos;s cost.
        </p></div>
      } />

    

      {/* At-Risk Groups Alert Banner */}
      {atRiskGroups.length > 0 && (
        <div className="mb-6 mx-2 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
          <div className="flex items-start gap-3">
            <IconAlertTriangle size={20} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                ⚠️ {atRiskGroups.length} {atRiskGroups.length === 1 ? 'group is' : 'groups are'} approaching their rate limits
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {atRiskGroups.map(([groupName, group]) => {
                  const dailyStatus = getRateLimitStatus(group.costs.daily, group.groupInfo.rateLimit?.daily);
                  const monthlyStatus = getRateLimitStatus(group.costs.monthly, group.groupInfo.rateLimit?.monthly);
                  const status = dailyStatus.percentage >= monthlyStatus.percentage ? dailyStatus : monthlyStatus;
                  return (
                    <span key={groupName} className={`text-xs font-medium px-2 py-1 rounded ${status.bgColor}`}>
                      {groupName}: {status.percentage.toFixed(1)}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Billing Groups Overview
            {groupSearchTerm && (
              <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
                ({filteredBillingGroups.length} of {Object.keys(billingGroups).length} groups)
              </span>
            )}
          </h3>
          {/* Search Bar - only show if there are multiple groups */}
          {Object.keys(billingGroups).length > 1 && (
            <div className="px-2">
              <Search
                placeholder="Search billing groups..."
                searchTerm={groupSearchTerm}
                onSearch={setGroupSearchTerm}
                paddingY="py-2"
              />
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Sort Options */}
          {Object.keys(billingGroups).length > 1 && (
            <div className="flex items-center space-x-2">
              <select
                value={groupsSortBy}
                onChange={(e) => setGroupsSortBy(e.target.value as 'cost' | 'name' | 'rateLimit')}
                className="text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="cost">Sort: Cost ↓</option>
                <option value="name">Sort: Name A-Z</option>
                <option value="rateLimit">Sort: Rate Limit Usage ↓</option>
              </select>
              
              <button
                onClick={() => setShowAtRiskFirst(!showAtRiskFirst)}
                className={`text-sm px-3 py-2 rounded-md transition-colors ${
                  showAtRiskFirst
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
                }`}
                title="Show at-risk groups first"
              >
                {showAtRiskFirst ? '⚠️ At-Risk First' : 'Show All'}
              </button>
            </div>
          )}
          
          <button
            onClick={downloadGroupsCSV}
            disabled={userLoading || Object.keys(billingGroups).length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download CSV"
            style={{ opacity: userLoading || Object.keys(billingGroups).length === 0 ? 0.5 : 1 }}
          >
            <IconDownload size={16} />
            <span>CSV</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={groupsLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh data"
          >
            {groupsLoading ? (
              <LoadingIcon style={{ width: '16px', height: '16px' }} />
            ) : (
              <IconRefresh size={16} />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {groupsError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mx-2">
          <p className="text-red-800 dark:text-red-200">{groupsError}</p>
        </div>
      )}

      {/* Loading State */}
      {groupsLoading && !groupsError && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <LoadingIcon style={{ width: '24px', height: '24px' }} />
            <span className="text-lg text-gray-700 dark:text-gray-300">Loading billing groups data...</span>
          </div>
        </div>
      )}

      {/* Billing Groups Cards */}
      {!groupsLoading && !groupsError && (
        <div className="flex-1 overflow-auto px-2">
          {Object.keys(billingGroups).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No billing groups data available</p>
            </div>
          ) : filteredBillingGroups.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No billing groups found matching &quot;{groupSearchTerm}&quot;</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBillingGroups.map(([groupName, group]) => (
                <div key={groupName} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                  {/* Group Header */}
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <IconBuilding className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                              {groupName}
                            </h3>

                            {/* Rate Limit Badge */}
                            {group.groupInfo.rateLimit && Array.isArray(group.groupInfo.rateLimit) && group.groupInfo.rateLimit.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                                💰 {group.groupInfo.rateLimit.map((limit: any) => `$${limit.rate}/${limit.period}`).join(', ')}
                              </span>
                            )}

                            {(() => {
                              const worstStatus = getGroupWorstRateLimitStatus(group);
                              if (worstStatus.status !== 'unlimited') {
                                const statusEmoji = worstStatus.status === 'red' ? '🔴' : worstStatus.status === 'orange' ? '🟠' : worstStatus.status === 'yellow' ? '🟡' : '🟢';
                                return (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${worstStatus.bgColor}`}>
                                    {statusEmoji} {worstStatus.label}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Created by: {getUserDisplayName(group.groupInfo.createdBy)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(group.costs.total)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total cost</p>
                      </div>
                    </div>
                  </div>

                  {/* Group Stats - Compact Layout */}
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Direct Members Count */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Direct</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{group.groupInfo.directMemberCount}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">members</p>
                      </div>

                      {/* Indirect Members Count */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Indirect</p>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{group.groupInfo.indirectMemberCount}</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">members</p>
                      </div>
                    </div>

                    {/* Direct and Indirect Cost Pills */}
                    <div className="flex gap-2 mb-6">
                      <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                        💰 {formatCurrency(group.members.direct.reduce((sum, user) => sum + user.totalCost, 0))} Direct
                      </span>
                      <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                        💰 {formatCurrency(group.members.indirect.reduce((sum, user) => sum + user.totalCost, 0))} Indirect
                      </span>
                    </div>

                    {/* Avg Per Member and Total Combined */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {/* Avg Per Member */}
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Avg/Member</p>
                        <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(group.costs.avgPerMember)}</p>
                      </div>

                      {/* Total Combined */}
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Total Combined</p>
                        <p className="text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(
                          group.members.direct.reduce((sum, user) => sum + user.totalCost, 0) +
                          group.members.indirect.reduce((sum, user) => sum + user.totalCost, 0)
                        )}</p>
                      </div>
                    </div>

                    {/* Rate Limit Progress Bars */}
                    {group.groupInfo.rateLimit && (group.groupInfo.rateLimit.daily || group.groupInfo.rateLimit.monthly) && (
                      <div className="mb-4 space-y-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                          <IconGauge size={16} /> Rate Limit Utilization
                        </p>
                        
                        {/* Daily Rate Limit */}
                        {group.groupInfo.rateLimit.daily && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Daily Limit</span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                {group.costs.daily} / {formatCurrency(group.groupInfo.rateLimit.daily)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  group.costs.daily >= group.groupInfo.rateLimit.daily 
                                    ? 'bg-red-500 dark:bg-red-400' 
                                    : group.costs.daily >= (group.groupInfo.rateLimit.daily * 0.8)
                                    ? 'bg-amber-500 dark:bg-amber-400'
                                    : 'bg-green-500 dark:bg-green-400'
                                }`}
                                style={{ width: `${Math.min((group.costs.daily / group.groupInfo.rateLimit.daily) * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {Math.round((group.costs.daily / group.groupInfo.rateLimit.daily) * 100)}%
                              </span>
                              {group.costs.daily >= group.groupInfo.rateLimit.daily && (
                                <span className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                  <IconAlertTriangle size={12} /> Over limit by {formatCurrency(group.costs.daily - group.groupInfo.rateLimit.daily)}
                                </span>
                              )}
                              {group.costs.daily >= (group.groupInfo.rateLimit.daily * 0.8) && group.costs.daily < group.groupInfo.rateLimit.daily && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Near limit</span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Monthly Rate Limit */}
                        {group.groupInfo.rateLimit.monthly && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Monthly Limit</span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(group.costs.monthly)} / {formatCurrency(group.groupInfo.rateLimit.monthly)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  group.costs.monthly >= group.groupInfo.rateLimit.monthly 
                                    ? 'bg-red-500 dark:bg-red-400' 
                                    : group.costs.monthly >= (group.groupInfo.rateLimit.monthly * 0.8)
                                    ? 'bg-amber-500 dark:bg-amber-400'
                                    : 'bg-green-500 dark:bg-green-400'
                                }`}
                                style={{ width: `${Math.min((group.costs.monthly / group.groupInfo.rateLimit.monthly) * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {Math.round((group.costs.monthly / group.groupInfo.rateLimit.monthly) * 100)}%
                              </span>
                              {group.costs.monthly >= group.groupInfo.rateLimit.monthly && (
                                <span className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                  <IconAlertTriangle size={12} /> Over limit by {formatCurrency(group.costs.monthly - group.groupInfo.rateLimit.monthly)}
                                </span>
                              )}
                              {group.costs.monthly >= (group.groupInfo.rateLimit.monthly * 0.8) && group.costs.monthly < group.groupInfo.rateLimit.monthly && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Near limit</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}


                    {/* Top Spenders - Enhanced */}
                    {group.members.topSpenders && group.members.topSpenders.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">👥 Top Spenders</p>
                        <div className="space-y-2">
                          {group.members.topSpenders.slice(0, 5).map((user, index) => {
                            const displayName = getUserDisplayName(user.email);
                            const initials = displayName.split(/[\s.@]/).filter(p => p).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                            let proportion = 0;
                            if (group.groupInfo.rateLimit && Array.isArray(group.groupInfo.rateLimit) && group.groupInfo.rateLimit.length > 0) {
                              const rateLimit = group.groupInfo.rateLimit[0].rate;
                              proportion = (user.totalCost / rateLimit) * 100;
                            } else {
                              proportion = (user.totalCost / group.costs.total) * 100;
                            }
                            const avatarColors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500'];
                            const avatarColor = avatarColors[index % avatarColors.length];
                            
                            return (
                              <div key={`${user.email}-${index}`} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                {/* Avatar */}
                                <div className={`${avatarColor} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-white text-xs font-bold">{initials || user.email[0]}</span>
                                </div>
                                
                                {/* Name and Type */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {displayName}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {user.membershipType === 'direct' ? '👤 Direct' : '🔗 Indirect'}
                                  </div>
                                </div>
                                
                                {/* Cost */}
                                <div className="text-right flex-shrink-0">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(user.totalCost)}
                                  </span>
                                </div>
                                
                                {/* Proportion Indicator */}
                                <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex-shrink-0">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700"
                                    style={{ width: `${proportion}%` }}
                                  ></div>
                                </div>
                                
                                {/* Percentage */}
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-10 text-right">
                                  {proportion.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Expand Members Button */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleGroupMembersExpansion(groupName)}
                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        {expandedGroupMembers === groupName ? '↑ Hide Members' : '↓ View All Members'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Members View */}
                  {expandedGroupMembers === groupName && (
                    <div className="px-6 pb-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="pt-4">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Direct Members */}
                          <div>
                            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                              Direct Members ({group.members.direct.length})
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {group.members.direct.map((user, index) => 
                                <div key={`${groupName}-direct-${user.email}-${index}`}>
                                  {renderMemberWithDuplicateHighlight(user, groupName, index, true)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Indirect Members */}
                          <div>
                            <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2">
                              Indirect Members ({group.members.indirect.length})
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {group.members.indirect.map((user, index) => 
                                <div key={`${groupName}-indirect-${user.email}-${index}`}>
                                  {renderMemberWithDuplicateHighlight(user, groupName, index, false)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRateLimitsTab = () => {
    const activeLimits = normalizeRateLimits(adminRateLimits as any).filter(
      l => l.rate !== null && l.period !== 'Unlimited'
    );
    // Limits we can actually compute from bulk user data (hourly data not available in list endpoint)
    const computableLimits = activeLimits.filter(l => l.period !== 'Hourly');
    const hourlyLimits = activeLimits.filter(l => l.period === 'Hourly');

    type UserLimitRow = {
      email: string;
      dailyCost: number;
      monthlyCost: number;
      totalCost: number;
      worstPct: number;
      worstPeriod: string;
      worstLimit: number;
      worstSpent: number;
      limitSource: 'Admin' | 'Group' | 'Both';
      groupName?: string;
      groupNames: string[];
      hasAdminLimit: boolean;
      // all limit breakdowns for tooltip/detail
      limitBreakdown: { period: string; spent: number; limit: number; pct: number; source: string }[];
    };

    const userRows: UserLimitRow[] = [];

    userCosts.forEach(user => {
      let worstPct = 0;
      let worstPeriod = '';
      let worstLimit = 0;
      let worstSpent = 0;
      let worstLimitSource: 'Admin' | 'Group' = 'Admin';
      let groupName: string | undefined;
      const groupNames: string[] = [];
      const limitBreakdown: UserLimitRow['limitBreakdown'] = [];
      // Only non-Hourly limits are computable from bulk list data
      const hasAdminLimit = activeLimits.some(l => l.period !== 'Hourly');

      activeLimits.forEach(limit => {
        // dailyCost  = today's spend only
        // monthlyCost = prior days this month (excluding today)
        // totalCost  = dailyCost + monthlyCost = full MTD spend
        // hourlyCost is NOT available in the admin list endpoint → skip Hourly
        if (limit.period === 'Hourly') return; // no per-hour data in bulk list
        let spent = 0;
        if (limit.period === 'Daily')   spent = user.dailyCost;               // today only
        else if (limit.period === 'Monthly') spent = user.totalCost;          // full MTD (daily + monthly)
        else if (limit.period === 'Total')   spent = user.totalCost;          // full MTD
        const pct = limit.rate ? (spent / limit.rate) * 100 : 0;
        limitBreakdown.push({ period: limit.period, spent, limit: limit.rate ?? 0, pct, source: 'Admin' });
        if (pct > worstPct) {
          worstPct = pct; worstPeriod = limit.period;
          worstLimit = limit.rate ?? 0; worstSpent = spent; worstLimitSource = 'Admin';
        }
      });

      Object.entries(billingGroups).forEach(([gName, group]) => {
        const isInGroup = group.members.all.some(m => m.email === user.email);
        if (!isInGroup) return;
        const gDaily = group.groupInfo.rateLimit?.daily;
        const gMonthly = group.groupInfo.rateLimit?.monthly;
        if (!gDaily && !gMonthly) return;
        // Track all groups this user belongs to that have limits
        if (!groupNames.includes(gName)) groupNames.push(gName);
        if (gDaily) {
          const spent = user.dailyCost; // today only
          const pct = (spent / gDaily) * 100;
          limitBreakdown.push({ period: 'Daily', spent, limit: gDaily, pct, source: gName });
          if (pct > worstPct) {
            worstPct = pct; worstPeriod = 'Daily'; worstLimit = gDaily;
            worstSpent = spent; worstLimitSource = 'Group'; groupName = gName;
          }
        }
        if (gMonthly) {
          const spent = user.totalCost; // full MTD (dailyCost + monthlyCost)
          const pct = (spent / gMonthly) * 100;
          limitBreakdown.push({ period: 'Monthly', spent, limit: gMonthly, pct, source: gName });
          if (pct > worstPct) {
            worstPct = pct; worstPeriod = 'Monthly'; worstLimit = gMonthly;
            worstSpent = spent; worstLimitSource = 'Group'; groupName = gName;
          }
        }
      });

      // Derive accurate source: Admin only, Group only, or Both
      const hasGroupLimit = groupNames.length > 0;
      const limitSource: 'Admin' | 'Group' | 'Both' =
        hasAdminLimit && hasGroupLimit ? 'Both' :
        hasGroupLimit ? 'Group' : 'Admin';

      const hasAnyLimit = hasAdminLimit || hasGroupLimit;
      if (hasAnyLimit) {
        userRows.push({
          email: user.email, dailyCost: user.dailyCost,
          monthlyCost: user.monthlyCost, totalCost: user.totalCost,
          worstPct, worstPeriod, worstLimit, worstSpent,
          limitSource, groupName, groupNames, hasAdminLimit, limitBreakdown,
        });
      }
    });

    userRows.sort((a, b) => b.worstPct - a.worstPct);

    const filteredRows = userRows.filter(r =>
      !rateLimitSearch || r.email.toLowerCase().includes(rateLimitSearch.toLowerCase())
    );

    const exceededCount  = userRows.filter(r => r.worstPct >= 100).length;
    const warningCount   = userRows.filter(r => r.worstPct >= 80 && r.worstPct < 100).length;
    const healthyCount   = userRows.filter(r => r.worstPct < 80).length;
    const topUser        = userRows[0];

    const noLimitsConfigured = computableLimits.length === 0 &&
      !Object.values(billingGroups).some(g => g.groupInfo.rateLimit?.daily || g.groupInfo.rateLimit?.monthly);

    // Status pill for a row
    const statusPill = (pct: number) => {
      if (pct >= 100) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Exceeded
        </span>
      );
      if (pct >= 80) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" /> Warning
        </span>
      );
      if (pct >= 50) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" /> Moderate
        </span>
      );
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Healthy
        </span>
      );
    };

    // Progress bar with segmented track
    const pctBar = (pct: number) => {
      const capped = Math.min(pct, 100);
      const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-emerald-400';
      const textColor = pct >= 100 ? 'text-red-600 dark:text-red-400 font-bold' :
                        pct >= 80  ? 'text-orange-500 dark:text-orange-400 font-semibold' :
                                     'text-gray-500 dark:text-gray-400';
      return (
        <div className="flex items-center gap-3 w-full">
          <div className="relative flex-1 h-2.5 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden min-w-[100px]">
            {/* threshold markers */}
            <div className="absolute top-0 h-full w-px bg-yellow-300 dark:bg-yellow-500 opacity-60" style={{ left: '50%' }} />
            <div className="absolute top-0 h-full w-px bg-orange-400 dark:bg-orange-500 opacity-80" style={{ left: '80%' }} />
            <div className={`${color} h-full rounded-full transition-all duration-300`} style={{ width: `${capped}%` }} />
          </div>
          <span className={`text-xs w-[42px] text-right flex-shrink-0 ${textColor}`}>{pct.toFixed(1)}%</span>
        </div>
      );
    };

    const sourceBadge = (source: string, group?: string, groupNames?: string[]) => {
      if (source === 'Admin') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
          <IconUserCog size={11} /> Admin
        </span>
      );
      if (source === 'Both') {
        const groupLabel = groupNames && groupNames.length > 0
          ? groupNames.length === 1
            ? groupNames[0].length > 12 ? groupNames[0].slice(0, 12) + '…' : groupNames[0]
            : `${groupNames.length} groups`
          : 'Group';
        const fullTitle = groupNames ? `Admin + ${groupNames.join(', ')}` : 'Admin + Group';
        return (
          <div className="flex flex-col gap-0.5" title={fullTitle}>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
              <IconUserCog size={11} /> Admin
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
              <IconBuilding size={11} /> {groupLabel}
            </span>
          </div>
        );
      }
      const groupLabel = groupNames && groupNames.length > 1
        ? `${groupNames.length} groups`
        : group ? (group.length > 16 ? group.slice(0, 16) + '…' : group) : 'Group';
      const fullTitle = groupNames && groupNames.length > 1 ? groupNames.join(', ') : group;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700" title={fullTitle}>
          <IconBuilding size={11} /> {groupLabel}
        </span>
      );
    };

    return (
      <div className="flex flex-col h-full gap-3 px-1">

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-4 gap-3">

          {/* Over limit */}
          <div className={`rounded-xl p-4 border-2 flex items-center gap-4 ${
            exceededCount > 0
              ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
              : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
          }`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
              exceededCount > 0 ? 'bg-red-100 dark:bg-red-800/40' : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <IconShieldX size={22} className="text-red-400 dark:text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Over Limit</p>
              <p className={`text-3xl font-extrabold leading-none mt-0.5 ${exceededCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-red-300 dark:text-red-700'}`}>
                {exceededCount}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">≥ 100% of limit</p>
            </div>
          </div>

          {/* Near limit */}
          <div className={`rounded-xl p-4 border-2 flex items-center gap-4 ${
            warningCount > 0
              ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700'
              : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
          }`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
              warningCount > 0 ? 'bg-orange-100 dark:bg-orange-800/40' : 'bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <IconAlertTriangle size={22} className="text-orange-400 dark:text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Near Limit</p>
              <p className={`text-3xl font-extrabold leading-none mt-0.5 ${warningCount > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-orange-300 dark:text-orange-700'}`}>
                {warningCount}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">80 – 99% of limit</p>
            </div>
          </div>

          {/* Configured limits */}
          <div className="rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-start gap-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 dark:bg-blue-900/30">
              <IconGauge size={22} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Configured Limits</p>
              {activeLimits.length === 0 ? (
                <p className="text-sm text-gray-400">None set</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {computableLimits.map((l, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        l.period === 'Daily'   ? 'bg-blue-400' :
                        l.period === 'Monthly' ? 'bg-teal-400' : 'bg-gray-400'
                      }`} />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(l.rate ?? 0)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">/ {l.period}</span>
                    </div>
                  ))}
                  {hourlyLimits.map((l, i) => (
                    <div key={`h-${i}`} className="flex items-center gap-1.5" title="Hourly utilization cannot be computed from bulk data">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-300" />
                      <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
                        {formatCurrency(l.rate ?? 0)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">/ Hourly</span>
                      <span className="text-xs text-gray-400 italic">(N/A)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top user */}
          <div className="rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-start gap-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-50 dark:bg-amber-900/30">
              <IconUsers size={22} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Highest Utilization</p>
              {topUser ? (
                <>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate" title={topUser.email}>
                    {getUserDisplayName(topUser.email) !== topUser.email
                      ? getUserDisplayName(topUser.email)
                      : topUser.email.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate" title={topUser.email}>{topUser.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {statusPill(topUser.worstPct)}
                    <span className={`text-xs font-semibold ${topUser.worstPct >= 100 ? 'text-red-500' : 'text-orange-400'}`}>
                      {topUser.worstPct.toFixed(1)}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* ── No limits notice ── */}
        {noLimitsConfigured && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
            <IconInfoCircle size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">No rate limits configured</p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
                Set admin-wide or billing group rate limits in the <strong>Admin → Configurations</strong> panel. Utilization data will appear here automatically once limits are set.
              </p>
            </div>
          </div>
        )}

        {/* ── Hourly-only notice ── */}
        {!noLimitsConfigured && hourlyLimits.length > 0 && computableLimits.length === 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-start gap-3">
            <IconInfoCircle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Only <strong>Hourly</strong> limits are configured. Per-hour spend data is not available in the admin user list — utilization cannot be computed. Add a Daily or Monthly limit to see utilization here.
            </p>
          </div>
        )}

        {/* ── Loading state ── */}
        {userLoading && autoLoadState.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 px-1">
            <LoadingIcon style={{ width: '14px', height: '14px' }} />
            <span>Loading user cost data — {autoLoadState.loadedCount} users so far…</span>
          </div>
        )}

        {/* ── Main table ── */}
        {!noLimitsConfigured && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">

            {/* Search + legend row */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </span>
                <input
                  type="text"
                  placeholder="Search by email…"
                  value={rateLimitSearch}
                  onChange={e => setRateLimitSearch(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {/* mini legend */}
              <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"/>healthy</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"/>moderate</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"/>warning</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/>exceeded</span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col">
              {/* table header */}
              <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-750">
                <div className="flex items-center gap-2">
                  <IconGauge size={16} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    User Rate Limit Utilization
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    · {filteredRows.length} of {userRows.length} users shown
                    {userRows.length > 0 && ` · sorted by highest utilization`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {exceededCount > 0 && <span className="text-red-500 font-medium">{exceededCount} exceeded</span>}
                  {warningCount  > 0 && <span className="text-orange-500 font-medium">{warningCount} near limit</span>}
                  {healthyCount  > 0 && <span className="text-emerald-500 font-medium">{healthyCount} healthy</span>}
                </div>
              </div>

              {filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                  <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                    <IconShieldX size={32} className="text-green-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-600 dark:text-gray-300">No user data available yet</p>
                  <p className="text-sm mt-1">User cost data is still loading or no users have been found</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[220px]">User</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[200px]">Utilization</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Worst Period</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Spent</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Limit</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Daily Spend</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">MTD Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredRows.map((row, i) => {
                        const isExpanded = expandedRateLimitUser === row.email;
                        const fullUser = userCosts.find(u => u.email === row.email);
                        const apiKeyAccounts = fullUser?.accounts?.filter(a => a.accountInfo.includes('#') && a.accountInfo.split('#')[1] !== 'NA') ?? [];
                        const regularAccounts = fullUser?.accounts?.filter(a => !a.accountInfo.includes('#') || a.accountInfo.split('#')[1] === 'NA') ?? [];

                        const rowBg = row.worstPct >= 100
                          ? 'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : row.worstPct >= 80
                          ? 'bg-orange-50/60 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
                        const leftBorder = row.worstPct >= 100 ? 'border-l-4 border-l-red-400'
                          : row.worstPct >= 80 ? 'border-l-4 border-l-orange-400'
                          : 'border-l-4 border-l-transparent';

                        return (
                          <React.Fragment key={`${row.email}-${i}`}>
                            <tr
                              className={`${rowBg} ${leftBorder} transition-colors cursor-pointer`}
                              onClick={() => setExpandedRateLimitUser(isExpanded ? null : row.email)}
                            >
                              {/* Expand chevron + User */}
                              <td className="px-5 py-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-gray-400 mt-0.5 text-xs flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[190px]" title={row.email}>
                                      {getUserDisplayName(row.email) !== row.email
                                        ? getUserDisplayName(row.email)
                                        : row.email.split('@')[0]}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[190px]" title={row.email}>
                                      {row.email}
                                    </span>
                                    {/* mini account/api summary */}
                                    {fullUser && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {regularAccounts.length > 0 && `${regularAccounts.length} acct${regularAccounts.length > 1 ? 's' : ''}`}
                                        {regularAccounts.length > 0 && apiKeyAccounts.length > 0 && ' · '}
                                        {apiKeyAccounts.length > 0 && <span className="text-blue-400">{apiKeyAccounts.length} API key{apiKeyAccounts.length > 1 ? 's' : ''}</span>}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {/* Status pill */}
                              <td className="px-5 py-3">{statusPill(row.worstPct)}</td>
                              {/* Utilization bar */}
                              <td className="px-5 py-3">{pctBar(row.worstPct)}</td>
                              {/* Worst period */}
                              <td className="px-5 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                  row.worstPeriod === 'Hourly'  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                  row.worstPeriod === 'Daily'   ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                  row.worstPeriod === 'Monthly' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' :
                                                                  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                }`}>{row.worstPeriod}</span>
                              </td>
                              {/* Spent */}
                              <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{formatCurrency(row.worstSpent)}</td>
                              {/* Limit */}
                              <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{formatCurrency(row.worstLimit)}</td>
                              {/* Source */}
                              <td className="px-5 py-3">{sourceBadge(row.limitSource, row.groupName, row.groupNames)}</td>
                              {/* Daily */}
                              <td className="px-5 py-3 text-gray-600 dark:text-gray-400 text-xs font-mono">{formatCurrency(row.dailyCost)}</td>
                              {/* MTD */}
                              <td className="px-5 py-3 text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(row.dailyCost + row.monthlyCost)}</td>
                            </tr>

                            {/* ── Expanded detail row ── */}
                            {isExpanded && fullUser && (
                              <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <td colSpan={9} className="px-8 py-4">
                                  <div className="space-y-4">

                                    {/* All Limit Breakdowns */}
                                    {row.limitBreakdown.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                          <IconGauge size={13} /> Limit Breakdown
                                        </h4>
                                        <div className="flex flex-wrap gap-3">
                                          {row.limitBreakdown.map((b, bi) => (
                                            <div key={bi} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 min-w-[180px]">
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className={`text-xs font-semibold ${
                                                    b.period === 'Hourly'  ? 'text-purple-600 dark:text-purple-400' :
                                                    b.period === 'Daily'   ? 'text-blue-600 dark:text-blue-400' :
                                                    b.period === 'Monthly' ? 'text-teal-600 dark:text-teal-400' :
                                                                             'text-gray-600 dark:text-gray-400'
                                                  }`}>{b.period}</span>
                                                  <span className="text-xs text-gray-500 dark:text-gray-400">{b.source}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                                                    <div
                                                      className={`h-full rounded-full ${b.pct >= 100 ? 'bg-red-500' : b.pct >= 80 ? 'bg-orange-400' : b.pct >= 50 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                                                      style={{ width: `${Math.min(b.pct, 100)}%` }}
                                                    />
                                                  </div>
                                                  <span className={`text-xs font-bold w-10 text-right ${b.pct >= 100 ? 'text-red-500' : b.pct >= 80 ? 'text-orange-500' : 'text-gray-500'}`}>
                                                    {b.pct.toFixed(1)}%
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between mt-1">
                                                  <span className="text-xs text-gray-500">{formatCurrency(b.spent)} spent</span>
                                                  <span className="text-xs text-gray-400">of {formatCurrency(b.limit)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Accounts */}
                                    {regularAccounts.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                          <IconBuilding size={13} /> Accounts ({regularAccounts.length})
                                        </h4>
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                          <table className="min-w-full text-xs">
                                            <thead className="bg-gray-100 dark:bg-gray-800">
                                              <tr>
                                                <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Account</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Today</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Monthly</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Total</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                              {regularAccounts.sort((a, b) => b.totalCost - a.totalCost).map((acct, ai) => (
                                                <tr key={ai} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">{formatAccountInfo(acct.accountInfo)}</td>
                                                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(acct.dailyCost)}</td>
                                                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(acct.monthlyCost)}</td>
                                                  <td className="py-2 px-3 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(acct.totalCost)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* API Keys */}
                                    {apiKeyAccounts.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                          <IconKey size={13} /> API Key Usage ({apiKeyAccounts.length})
                                        </h4>
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                          <table className="min-w-full text-xs">
                                            <thead className="bg-gray-100 dark:bg-gray-800">
                                              <tr>
                                                <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Account / Key</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Today</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Monthly</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Total</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                              {apiKeyAccounts.sort((a, b) => b.totalCost - a.totalCost).map((acct, ai) => (
                                                <tr key={ai} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">{formatAccountInfo(acct.accountInfo)}</td>
                                                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(acct.dailyCost)}</td>
                                                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(acct.monthlyCost)}</td>
                                                  <td className="py-2 px-3 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(acct.totalCost)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  const tabs: Tabs[] = [
    {
      label: 'All Users',
      content: renderAllUsersTab()
    },
    {
      label: 'Billing Groups',
      content: renderBillingGroupsTab()
    },
    {
      label: 'Rate Limits',
      content: renderRateLimitsTab()
    }
  ];

  return (
    <Modal
      fullScreen={true}
      title="💰 Billing & Cost Management"
      showClose={true}
      onCancel={onClose}
      showCancel={false}
      showSubmit={false}
      content={
        <div className="flex flex-col h-full">
          <ActiveTabs
            id="cost-management-tabs"
            tabs={tabs}
            initialActiveTab={activeTab}
            onTabChange={(index) => setActiveTab(index)}
          />
        </div>
      }
    />
  );
};