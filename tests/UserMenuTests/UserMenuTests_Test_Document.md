# UserMenuTests Documentation

## Overview
This folder contains tests for user menu functionality, including base menu navigation, billing/cost management, personal data management, and theme customization.

## Test Files

### test_BaseUserMenu.py
**Test Class**: `ThemeChangeTests` (Note: Class name doesn't match file name)

#### Tests:
1. **test_presence_in_user_menu**
   - **Purpose**: This will test ensure all of the elements in the User Menu are present and clickable
   - **Functionality**: Tests:
     - User menu button visible and clickable
     - Menu opens when clicked
     - All menu items present:
       - Account settings
       - Billing & Cost Management
       - My Data
       - Theme settings
       - Other user menu options
     - Each menu item is clickable

---

### test_BillingAndCostManagement.py
**Test Class**: `BillingAndCostManagementTests`

#### Tests:

**All Users Tab:**
1. **test_check_presence_on_all_users_billing**
   - **Purpose**: This test ensures that elements in the modal are visible
   - **Functionality**: Verifies:
     - Billing modal opens
     - "All Users" tab is accessible
     - Key UI elements present (tables, headers, stats)

2. **test_check_user_count**
   - **Purpose**: This test ensures that Total User Count is equal to the represented number
   - **Functionality**: Tests:
     - Reading total user count display
     - Counting actual users in table
     - Verifying count matches

3. **test_check_cost_on_all_users**
   - **Purpose**: This test ensures that Total Cost is equal to the represented costs
   - **Functionality**: Tests:
     - Reading total cost display
     - Summing individual user costs
     - Verifying calculation accuracy (decimal precision)

4. **test_check_avg_cost_on_all_users**
   - **Purpose**: This test ensures that Avg Cost is equal to the represented costs
   - **Functionality**: Tests:
     - Reading average cost display
     - Calculating average from user costs
     - Verifying average calculation

5. **test_check_top_spender_on_all_users**
   - **Purpose**: This test ensures that Top Spender is represented correctly
   - **Functionality**: Tests:
     - Identifying top spender in table
     - Verifying top spender badge/indicator
     - Checking cost value is highest

6. **test_check_search_on_all_users**
   - **Purpose**: This test ensures that search functionality in the All Users tab works correctly
   - **Functionality**: Tests:
     - Entering search query
     - Verifying filtered results show matching users
     - Clearing search to show all users

7. **test_check_for_account_table**
   - **Purpose**: This test ensures that account table for a user in the All Users tab is visible
   - **Functionality**: Tests:
     - Expanding user row
     - Viewing detailed account table
     - Verifying transaction/usage details

8. **test_presence_on_billing_groups**
   - **Purpose**: Tests presence of elements in billing groups tab
   - **Functionality**: Verifies:
     - Billing Groups tab accessible
     - Key UI elements present

9. **test_billing_groups_count**
   - **Purpose**: Tests billing groups count accuracy
   - **Functionality**: Tests:
     - Reading groups count display
     - Counting actual groups
     - Verifying count matches

10. **test_billing_groups_top_spender**
    - **Purpose**: This test ensures that Top Spender is represented correctly
    - **Functionality**: Tests top spender identification in groups

11. **test_billing_groups_total_cost**
    - **Purpose**: Tests total cost calculation for billing groups
    - **Functionality**: Tests:
      - Reading total cost display
      - Summing group costs
      - Verifying calculation

12. **test_billing_groups_average_cost**
    - **Purpose**: Tests average cost calculation for billing groups
    - **Functionality**: Tests average cost accuracy

13. **test_billing_groups_indirect_plus_direct**
    - **Purpose**: This test ensures that indirect plus direct is represented correctly
    - **Functionality**: Tests:
      - Reading direct costs
      - Reading indirect costs
      - Verifying sum equals total

14. **test_billing_groups_search**
    - **Purpose**: This test ensures that the search function works correctly
    - **Functionality**: Tests search filtering in billing groups

---

### test_MyData.py
**Test Class**: `MyDataTests`

#### Tests:
1. **test_presence_in_user_menu**
   - **Purpose**: Tests presence and clickability of My Data table elements
   - **Functionality**: Tests:
     - My Data menu item accessible
     - Data table loads
     - Key columns present

2. **test_column_action_buttons**
   - **Purpose**: This will test ensure all of the Column Action Button in the My Data Table are clickable and display the appropriate menus
   - **Functionality**: Tests:
     - Column header action buttons visible
     - Clicking column actions opens menus
     - Sort, filter, hide column options work

3. **test_search_button_in_my_data**
   - **Purpose**: Tests search button functionality in My Data
   - **Functionality**: Tests:
     - Search button present
     - Clicking opens search interface
     - Search field accepts input

4. **test_filter_button_in_my_data**
   - **Purpose**: Tests filter button functionality in My Data
   - **Functionality**: Tests:
     - Filter button present
     - Clicking opens filter panel
     - Filter options available

5. **test_search_and_filter_input_in_my_data**
   - **Purpose**: Tests comprehensive search/filter/tag/delete workflow
   - **Functionality**: Tests:
     - Creating test data entries
     - Applying search filters
     - Using tag filters
     - Deleting filtered items
     - Verifying data updates

6. **test_show_hide_columns_in_my_data**
   - **Purpose**: Tests show/hide columns functionality including "Hide all" and "Show all" buttons
   - **Functionality**: Tests:
     - Accessing column visibility controls
     - Hiding individual columns
     - Using "Hide all" button
     - Using "Show all" button
     - Verifying column visibility changes

7. **test_toggle_density_columns_in_my_data**
   - **Purpose**: Tests the density toggle button functionality for the data table
   - **Functionality**: Tests:
     - Locating density toggle button
     - Cycling through density options (compact, standard, comfortable)
     - Verifying row spacing changes
     - Verifying data integrity maintained

---

### test_ThemeChange.py
**Test Class**: `ThemeChangeTests`

#### Tests:
1. **test_change_theme**
   - **Purpose**: This will test the change theme button in the User Menu and ensure it switches between light and dark accordingly
   - **Functionality**: Tests:
     - Locating theme toggle button
     - Clicking to switch theme
     - Verifying background color changes
     - Toggling back to original theme
     - Verifying theme persists across page refresh

2. **test_change_color_scheme**
   - **Purpose**: This will test the buttons in the User Menu and ensure it switches between the different color themes accordingly
   - **Functionality**: Tests:
     - Accessing color scheme options
     - Selecting different color schemes (blue, purple, green, etc.)
     - Verifying accent colors change
     - Testing multiple color scheme changes
     - Verifying color scheme persists

---

## Common Test Patterns

### User Menu Navigation Flow:
1. Locate user menu button (typically top-right corner)
2. Click to open menu dropdown
3. Verify menu items present
4. Click specific menu item
5. Verify corresponding page/modal opens

### Billing & Cost Management Flow:
1. Open Billing & Cost Management from user menu
2. Navigate between tabs (All Users, Billing Groups)
3. Verify data displays correctly
4. Test calculations (totals, averages, top spenders)
5. Test filtering and search
6. Verify detailed views (expand rows for details)

### My Data Management Flow:
1. Open My Data from user menu
2. Verify data table loads with entries
3. Test search and filter functionality
4. Test column operations (sort, hide/show, resize)
5. Test data operations (tag, delete, export)
6. Verify table customization (density, column visibility)

### Theme Customization Flow:
1. Open user menu
2. Access theme settings
3. Toggle between light/dark theme
4. Select color scheme
5. Verify visual changes applied
6. Verify preferences persist

## Notes

### Billing & Cost Management:
- Supports decimal precision for cost calculations (uses Decimal library)
- Provides both individual user and group-level cost tracking
- Includes top spender identification
- Search functionality filters in real-time
- Expandable rows show detailed transaction history
- Supports both direct and indirect cost tracking for groups

### My Data:
- Comprehensive data table with advanced features
- Column customization (show/hide, reorder)
- Density options affect row spacing
- Search applies across all visible columns
- Filter supports multiple criteria
- Tag-based organization
- Bulk operations (delete, export)

### Theme Settings:
- Light/dark theme toggle
- Multiple color scheme options
- Theme preferences persist in browser
- Changes apply instantly without page reload
- Color schemes affect accent colors throughout UI

### General:
- All user menu tests assume authenticated session
- Some tests require specific user permissions (admin for billing)
- Tests use explicit waits for dynamic content loading
- Decimal calculations tested for financial accuracy
- Table tests verify both display and data integrity
