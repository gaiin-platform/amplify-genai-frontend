import { FC, useEffect, useState, useCallback } from "react";
import { Modal } from "../ReusableComponents/Modal";
import { ActiveTabs, Tabs } from "../ReusableComponents/ActiveTabs";
import { getAllUserMtdCosts, getBillingGroupsCosts, getAllUserMtdCostsRecursive, AutoLoadProgress } from "@/services/mtdCostService";
import { LoadingIcon } from "../Loader/LoadingIcon";
import { IconRefresh, IconDownload, IconUsers, IconBuilding, IconLink, IconAlertTriangle, IconInfoCircle, IconKey, IconUserCog, IconBolt } from "@tabler/icons-react";
import { InfoBox } from "../ReusableComponents/InfoBox";
import React from "react";
import Search from "../Search/Search";
import { formatCurrency } from "@/utils/app/data";

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

const MTD_USAGE_LIMITS = [25, 50, 100, 250, 500];

export const UserCostsModal: FC<Props> = ({ open, onClose }) => {
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
  
  // Search state
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [groupSearchTerm, setGroupSearchTerm] = useState<string>('');
  
  // Billing Groups tab state
  const [billingGroups, setBillingGroups] = useState<Record<string, BillingGroup>>({});
  const [groupsSummary, setGroupsSummary] = useState<BillingGroupsResponse['summary'] | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [expandedGroupMembers, setExpandedGroupMembers] = useState<string | null>(null);

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
      setUserCosts(progress.users);
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

  // Filter users based on search term
  const filteredUsers = userCosts.filter((user) => {
    if (!userSearchTerm.trim()) return true;
    const searchLower = userSearchTerm.toLowerCase();
    const emailInfo = cleanEmailDisplay(user.email);
    return (
      user.email.toLowerCase().includes(searchLower) ||
      emailInfo.displayName.toLowerCase().includes(searchLower)
    );
  });

  // Filter billing groups based on search term
  const filteredBillingGroups = Object.entries(billingGroups).filter(([groupName, group]) => {
    if (!groupSearchTerm.trim()) return true;
    const searchLower = groupSearchTerm.toLowerCase();
    return (
      groupName.toLowerCase().includes(searchLower) ||
      group.groupInfo.createdBy.toLowerCase().includes(searchLower)
    );
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
      } else if (apiKeyInfo.includes('/ownerKey/') && accountName.endsWith('_account')) {
        // Agent key - personal key with agent account
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
    } else {
      fetchBillingGroupsCosts();
    }
  };

  const toggleUserExpansion = (email: string) => {
    setExpandedUser(expandedUser === email ? null : email);
  };

  const toggleGroupMembersExpansion = (groupName: string) => {
    setExpandedGroupMembers(expandedGroupMembers === groupName ? null : groupName);
  };

  // CSV Download functions
  const downloadUsersCSV = () => {
    const headers = ['Email', 'Daily Cost', 'Monthly Cost', 'Total Cost', 'Accounts Count'];
    const csvContent = [
      headers.join(','),
      ...userCosts.map(user => [
        user.email,
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
    const headers = ['Group Name', 'Total Cost', 'Daily Cost', 'Monthly Cost', 'Direct Members', 'Indirect Members', 'Total Members', 'Avg Cost Per Member'];
    const csvContent = [
      headers.join(','),
      ...Object.entries(billingGroups).map(([groupName, group]) => [
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
              {user.email}
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
              {user.email}
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
              {user.email}
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
            {user.email}
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
              {user.email}
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
    avgCostPerUser: userCosts.length > 0 ? userCosts.reduce((sum, user) => sum + user.totalCost, 0) / userCosts.length : 0,
    topSpender: userCosts.length > 0 ? userCosts.reduce((prev, current) => (prev.totalCost > current.totalCost) ? prev : current) : null,
    // Keep track of filtered counts for display purposes
    filteredTotalUsers: filteredUsers.length
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
                        {emailInfo.isGroup ? emailInfo.displayName : emailInfo.displayName.split('@')[0]}
                      </p>
                    </>
                  );
                })()}
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">{usersSummary.topSpender ? formatCurrency(usersSummary.topSpender.totalCost) : 'N/A'}</p>
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
          <div className="mt-3 w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out animate-pulse"
              style={{ width: '100%' }}
            ></div>
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
                        User Email
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
                                    <span>{emailInfo.displayName}</span>
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
                        {expandedUser === user.email && user.accounts && user.accounts.length > 0 && (
                          <tr key={`${user.email}-details`} className="bg-gray-50 dark:bg-gray-900">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="ml-6">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Account Breakdown:</h4>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Account Info</th>
                                        <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Daily Cost</th>
                                        <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Monthly Cost</th>
                                        <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Total Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {user.accounts.map((account, accountIndex) => (
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

    

      {/* Controls */}
      <div className="my-6 flex items-center justify-between px-2">
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
        
        
        <div className="flex items-center space-x-2">
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <IconBuilding className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {groupName}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Created by: {group.groupInfo.createdBy}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(group.costs.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Group Stats */}
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                          {group.groupInfo.directMemberCount}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Direct</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                          {group.groupInfo.indirectMemberCount}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Indirect</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                          {group.groupInfo.totalMemberCount}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Daily:</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(group.costs.daily)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Monthly:</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(group.costs.monthly)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Avg/Member:</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(group.costs.avgPerMember)}</p>
                      </div>
                    </div>

                    {/* Cost Distribution Bar */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Cost Distribution:</p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 dark:bg-blue-400 float-left"
                          style={{ 
                            width: `${(group.members.direct.reduce((sum, user) => sum + user.totalCost, 0) / group.costs.total * 100)}%` 
                          }}
                          title="Direct members"
                        ></div>
                        <div 
                          className="h-full bg-purple-500 dark:bg-purple-400 float-left"
                          style={{ 
                            width: `${(group.members.indirect.reduce((sum, user) => sum + user.totalCost, 0) / group.costs.total * 100)}%` 
                          }}
                          title="Indirect members"
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>Direct ({Math.round(group.members.direct.reduce((sum, user) => sum + user.totalCost, 0) / group.costs.total * 100)}%)</span>
                        <span>Indirect ({Math.round(group.members.indirect.reduce((sum, user) => sum + user.totalCost, 0) / group.costs.total * 100)}%)</span>
                      </div>
                    </div>

                    {/* Top Spenders */}
                    {group.members.topSpenders && group.members.topSpenders.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">👥 Top Spenders:</p>
                        <div className="flex flex-wrap gap-2">
                          {group.members.topSpenders.slice(0, 3).map((user, index) => (
                            <div key={`${user.email}-${index}`} className="flex items-center text-xs bg-gray-50 dark:bg-gray-700 rounded-md p-2 min-w-[180px]">
                              <span className="text-gray-900 dark:text-white mr-2">
                                {index + 1}.
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-gray-900 dark:text-white break-all">
                                  {user.email}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs">
                                  {user.membershipType} • {formatCurrency(user.totalCost)}
                                </div>
                              </div>
                            </div>
                          ))}
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

  if (!open) return null;

  const tabs: Tabs[] = [
    {
      label: 'All Users',
      content: renderAllUsersTab()
    },
    {
      label: 'Billing Groups',
      content: renderBillingGroupsTab()
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
          <div className="mb-4 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Token Total: {groupsSummary ? formatCurrency(groupsSummary.totalCost) : formatCurrency(usersSummary.totalCost)} MTD
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last Updated: {groupsSummary?.timestamp ? new Date(groupsSummary.timestamp).toLocaleTimeString() : 'Now'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {activeTab === 0 ? `${usersSummary.totalUsers} Users` : `${groupsSummary?.totalBillingGroups || 0} Groups`}
                </p>
              </div>
            </div>
          </div>

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