import { FC, useContext, useEffect, useState } from "react";
import { Modal } from "../ReusableComponents/Modal";
import HomeContext from "@/pages/api/home/home.context";
import { getAllUserMtdCosts } from "@/services/mtdCostService";
import { LoadingIcon } from "../Loader/LoadingIcon";
import { IconRefresh, IconEye, IconEyeOff } from "@tabler/icons-react";
import toast from "react-hot-toast";

interface AccountData {
  accountInfo: string;
  dailyCost: number;
  monthlyCost: number;
  totalCost: number;
}

interface UserMtdData {
  email: string;
  dailyCost: number;
  monthlyCost: number;
  totalCost: number;
  accounts: AccountData[];
}

interface UserCostsResponse {
  users: UserMtdData[];
  count: number;
  lastEvaluatedKey: any;
  hasMore: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const MTD_USAGE_LIMITS = [25, 50, 100];

export const UserCostsModal: FC<Props> = ({ open, onClose }) => {
  
  const [userCosts, setUserCosts] = useState<UserMtdData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [responseData, setResponseData] = useState<UserCostsResponse | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revealedAccounts, setRevealedAccounts] = useState<Set<string>>(new Set());

  // Fetch MTD costs
  const fetchMTDCosts = async (appendData = false, nextKey: any = null) => {
    if (appendData) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setUserCosts([]);
      setLastEvaluatedKey(null);
    }
    setError(null);
    
    try {
      const result = await getAllUserMtdCosts(limit, nextKey);
      // console.log('MTD Costs API Result:', result); // Debug log
      
      // The result should already be decoded by doRequestOp
      let data = result;
      
      // If result has a success property, it means there was an API wrapper
      if (result && typeof result === 'object' && 'success' in result) {
        if (!result.success) {
          setError(result.message || 'Failed to fetch MTD costs');
          return;
        }
        data = result.data || result;
      }
      
      console.log('Processed data:', data); // Debug log
      
      // Handle the response structure from your API
      if (data && data.users && Array.isArray(data.users)) {
        if (appendData) {
          setUserCosts(prev => [...prev, ...data.users]);
        } else {
          setUserCosts(data.users);
        }
        setResponseData(data);
        setLastEvaluatedKey(data.lastEvaluatedKey);
      } else if (data && Array.isArray(data)) {
        // Fallback if the response is directly an array
        const responseData = { users: data, count: data.length, lastEvaluatedKey: null, hasMore: false };
        if (appendData) {
          setUserCosts(prev => [...prev, ...data]);
        } else {
          setUserCosts(data);
        }
        setResponseData(responseData);
        setLastEvaluatedKey(null);
      } else {
        console.error('Unexpected response format:', data);
        setError(`Unexpected response format. Got: ${typeof data}`);
      }
    } catch (err) {
      setError('An error occurred while fetching MTD costs');
      console.error('Error fetching MTD costs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMTDCosts();
    }
  }, [open, limit]);

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatAccountInfo = (accountInfo: string, accountIndex: number, userEmail: string) => {
    const accountKey = `${userEmail}-${accountIndex}`;
    const isRevealed = revealedAccounts.has(accountKey);
    
    // Split by # to separate account name and API key
    const parts = accountInfo.split('#');
    const [accountName, apiKey] = parts;
    
    let apiComponent = null;
    // Handle sensitive API keys (starting with "amp-")
    if (apiKey && apiKey.startsWith('amp-')) {
      const toggleReveal = () => {
        setRevealedAccounts(prev => {
          const newSet = new Set(prev);
          if (newSet.has(accountKey)) {
            newSet.delete(accountKey);
          } else {
            newSet.add(accountKey);
          }
          return newSet;
        });
      };

      apiComponent = (
        <div className="flex flex-row gap-2">
        <span className="font-mono text-xs text-blue-500">{"API Accessed:"}</span>
        <div className="mx-w-[150px] flex items-center border border-neutral-500 rounded dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 overflow-x-auto">
          <button
            onClick={toggleReveal}
            className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={isRevealed ? "Hide API key" : "Show API key"}
          >
            {isRevealed ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
          <span className="px-2 text-xs font-mono">
            {isRevealed ? apiKey : '*'.repeat(Math.min(apiKey.length, 12))}
          </span>
        </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col">
        <span className="font-mono text-xs">Account: {accountName}</span>
        {apiComponent}
      </div>
    );
  };

  const handleRefresh = () => {
    fetchMTDCosts();
    toast.success('Data refreshed');
  };

  const handleLoadMore = () => {
    if (lastEvaluatedKey && responseData?.hasMore && !loadingMore) {
      fetchMTDCosts(true, lastEvaluatedKey);
    }
  };

  const toggleUserExpansion = (email: string) => {
    setExpandedUser(expandedUser === email ? null : email);
  };

  if (!open) return null;

  return (
    <Modal
      fullScreen={true}
      title="Users Cost Breakdown"
      showClose={true}
      onCancel={onClose}
      showCancel={false}
      showSubmit={false}
      content={
        <div className="flex flex-col h-full">
          {/* Controls */}
          <div className="mb-6 flex items-center justify-between px-2">
            <div className="flex items-center space-x-4">
              <label htmlFor="limit-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show:
              </label>
              <select
                id="limit-select"
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MTD_USAGE_LIMITS.map((limitOption) => (
                  <option key={limitOption} value={limitOption}>
                    {limitOption} users
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Refresh data"
            >
              {loading ? (
                <LoadingIcon style={{ width: '16px', height: '16px' }} />
              ) : (
                <IconRefresh size={16} />
              )}
              <span>Refresh</span>
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mx-2">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && !error && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <LoadingIcon style={{ width: '24px', height: '24px' }} />
                <span className="text-lg text-gray-700 dark:text-gray-300">Loading MTD usage data...</span>
              </div>
            </div>
          )}

          {/* Data Table */}
          {!loading && !error && (
            <div className="flex-1 overflow-hidden">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mx-2 h-full flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Month to Date Cost by User ({userCosts.length} {responseData?.hasMore ? `of ${responseData?.count || 'many'}` : 'total'})
                  </h2>
                </div>
                
                {userCosts.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No usage data available</p>
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
                        {userCosts.map((user, index) => (
                          <>
                            <tr key={user.email || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                <button
                                  onClick={() => toggleUserExpansion(user.email)}
                                  className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                                >
                                  <span>{expandedUser === user.email ? '▼' : '▶'}</span>
                                  <span>{user.email}</span>
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
                                            <tr key={accountIndex} className="border-b border-gray-100 dark:border-gray-800">
                                              <td className="py-2 px-4 text-gray-900 dark:text-white font-mono text-xs">
                                                {formatAccountInfo(account.accountInfo, accountIndex, user.email)}
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
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Load More Button */}
                {responseData?.hasMore && (
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingMore ? (
                        <>
                          <LoadingIcon style={{ width: '16px', height: '16px' }} />
                          <span>Loading more...</span>
                        </>
                      ) : (
                        <span>Load More Users</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
};