import { FC } from "react";




export interface DashboardMetrics {
    assistantId: string;
    assistantName: string;
    numUsers: number;
    totalConversations: number;
    averagePromptsPerConversation: number;
    entryPointDistribution: { [key: string]: number };
    categoryDistribution: { [key: string]: number };
    employeeTypeDistribution: { [key: string]: number };
    averageUserRating: number | null;
    averageSystemRating: number | null;
}

// Define types for our data structures
type DataPoint = {
    name: string;
    value: number;
};

// Simple bar chart implementation without external libraries
const SimpleBarChart: FC<{ data: DataPoint[], color?: string }> = ({
    data,
    color = "#0088FE"
}) => {
    // Find the maximum value for scaling
    const maxValue = Math.max(...data.map(item => item.value));

    // Sort data by value in descending order for better visualization
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="w-full">
            {sortedData.map((item, index) => (
                <div key={index} className="mb-2">
                    <div className="flex items-center">
                        <div className="w-32 text-sm truncate mr-2" title={item.name}>{item.name}</div>
                        <div className="flex-grow">
                            <div className="relative pt-1">
                                <div className="flex items-center justify-between">
                                    <div className="w-full mr-2">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded">
                                            <div
                                                className="h-4 rounded transition-all duration-500 ease-in-out"
                                                style={{
                                                    width: `${Math.max((item.value / maxValue) * 100, 5)}%`,
                                                    backgroundColor: color
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="ml-2 text-sm whitespace-nowrap">{item.value}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Simple pie chart representation without external libraries
const SimplePieList: FC<{ data: DataPoint[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

    // Sort data by value in descending order for better visualization
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="w-full">
            {sortedData.map((item, index) => {
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                return (
                    <div key={index} className="mb-3 flex items-center group hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded transition-colors duration-150">
                        <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <div className="text-sm flex-grow truncate" title={item.name}>{item.name}</div>
                        <div className="text-sm mr-2">{item.value}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 w-16">{percentage}%</div>
                    </div>
                );
            })}
        </div>
    );
};

export const Dashboard: FC<{ metrics: DashboardMetrics, supportConvAnalysis: boolean }> = ({ metrics, supportConvAnalysis }) => {
    // Transform object data into array format for visualization
    console.log("supportConvAnalysis:", supportConvAnalysis);

    const transformDistributionData = (data: { [key: string]: number }): DataPoint[] => {
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    };

    const entryPointData = supportConvAnalysis ? transformDistributionData(metrics.entryPointDistribution) : [];
    const categoryData = supportConvAnalysis ? transformDistributionData(metrics.categoryDistribution) : [];
    const employeeTypeData = supportConvAnalysis ? transformDistributionData(metrics.employeeTypeDistribution) : [];

    // Render star rating
    const renderStarRating = (rating: number | null) => {
        if (rating === null) return 'N/A';

        return (
            <div className="flex items-center">
                <span className="mr-2">{rating.toFixed(2)}</span>
                <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                            key={star}
                            className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    ))}
                </div>
            </div>
        );
    };

    // Progress bar component for comparison
    const ProgressBar: FC<{ label: string, value: number, maxValue: number, color: string }> = ({
        label, value, maxValue, color
    }) => (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm">{label}</span>
                <span className="text-sm font-semibold">{value.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                    className="h-2.5 rounded-full"
                    style={{
                        width: `${(value / maxValue) * 100}%`,
                        backgroundColor: color
                    }}
                ></div>
            </div>
        </div>
    );

    return (
        <div
            className="p-4 text-black dark:text-white overflow-auto h-full"
            style={{
                maxHeight: `${window.innerHeight * 0.75}px`,
                overflowY: 'auto'
            }}
        >
            <h2 className="text-2xl font-bold mb-4">Dashboard Metrics for {metrics.assistantName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Assistant ID: {metrics.assistantId}
            </p>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Unique Users</h3>
                    <p className="text-3xl font-bold">{metrics.numUsers}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Total Conversations</h3>
                    <p className="text-3xl font-bold">{metrics.totalConversations}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Avg. Prompts Per Conversation</h3>
                    <p className="text-3xl font-bold">{metrics.averagePromptsPerConversation.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">User Satisfaction</h3>
                    <div className="text-xl font-bold">
                        {renderStarRating(metrics.averageUserRating)}
                    </div>
                </div>
            </div>

            {/* Charts Section - Only show analysis-specific charts if supportConvAnalysis is true */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* Entry Point Distribution - Only show if supportConvAnalysis is true */}
                {supportConvAnalysis && entryPointData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="text-lg font-semibold mb-4">Entry Point Distribution</h3>
                        <div className="h-64 overflow-y-auto">
                            <SimpleBarChart data={entryPointData} color="#0088FE" />
                        </div>
                    </div>
                )}

                {/* Category Distribution - Only show if supportConvAnalysis is true */}
                {supportConvAnalysis && categoryData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
                        <div className="h-64 overflow-y-auto">
                            <SimplePieList data={categoryData} />
                        </div>
                    </div>
                )}

                {/* Group Type Distribution - Only show if supportConvAnalysis is true */}
                {supportConvAnalysis && employeeTypeData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="text-lg font-semibold mb-4">Group Type Distribution</h3>
                        <div className="h-64 overflow-y-auto">
                            <SimplePieList data={employeeTypeData} />
                        </div>
                    </div>
                )}

                {/* System Performance - Only show system rating if supportConvAnalysis is true */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-4">Performance</h3>
                    <div className="flex flex-col space-y-4">
                        {supportConvAnalysis && (
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">System Rating</p>
                                <div className="text-xl font-bold mt-1">
                                    {renderStarRating(metrics.averageSystemRating)}
                                </div>
                            </div>
                        )}

                        <div className="mt-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Rating{supportConvAnalysis ? 's Comparison' : ''}</p>
                            <div className="mt-2">
                                <ProgressBar
                                    label="User Rating"
                                    value={metrics.averageUserRating || 0}
                                    maxValue={5}
                                    color="#0088FE"
                                />

                                {supportConvAnalysis && (
                                    <ProgressBar
                                        label="System Rating"
                                        value={metrics.averageSystemRating || 0}
                                        maxValue={5}
                                        color="#00C49F"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};