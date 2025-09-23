# This file will contain all of the basic things in the User Menu.
# Making sure all the components are present thereeeeeeeeeeeeeee

import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    UnexpectedAlertPresentException,
    NoSuchElementException,
)
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest


class BillingAndCostManagementTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    def billing_and_cost_management_menu_open(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "User Menu Button should be initialized")

        user_menu_button.click()
        
        time.sleep(2)
        
        billing_open_menu = self.wait.until(EC.element_to_be_clickable((By.ID, "userCostInterface")))
        self.assertTrue(billing_open_menu, "User Cost Menu Button should be initialized")

        billing_open_menu.click()
        
        time.sleep(2)
        
        # Ensure the billing Chat Label appears after selection
        billing_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(billing_modal_title, "💰 Billing & Cost Management modal title should appear after selection")

        # Extract the text from the element
        modal_text = billing_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "💰 Billing & Cost Management", "Modal title should be '💰 Billing & Cost Management'")
        
        time.sleep(2)
        
    def billing_group_tab_open(self):
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)
        
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in tabs if tab.text == "Billing Groups"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Billing Groups' tab should be present")
        admin_supported_models_tab.click()
        time.sleep(5)
        
    # ----------------- Test Presence on All Users Billing -----------------
    """This test ensures that elements in the modal are visible"""

    def test_check_presence_on_all_users_billing(self):
        
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)
        
        # --- limit-select (Select element) ---
        limit_select = self.wait.until(EC.presence_of_element_located((By.ID, "limit-select")))
        self.assertTrue(limit_select, "Limit Select should be present")
        select = Select(limit_select)
        # iterate through available options
        for option in select.options:
            select.select_by_visible_text(option.text)
            time.sleep(0.25)
        select.select_by_value("50")
        time.sleep(1)

        # --- SearchBar (send keys) ---
        search_bar = self.wait.until(EC.presence_of_element_located((By.ID, "SearchBar")))
        self.assertTrue(search_bar, "SearchBar should be present")

        # --- downloadCSVButton (clickable) ---
        download_csv_button = self.wait.until(EC.element_to_be_clickable((By.ID, "downloadCSVButton")))
        self.assertTrue(download_csv_button, "Download CSV Button should be clickable")

        # --- refreshDataButton (clickable, click, sleep) ---
        refresh_data_button = self.wait.until(EC.element_to_be_clickable((By.ID, "refreshDataButton")))
        self.assertTrue(refresh_data_button, "Refresh Data Button should be clickable")
        # refresh_data_button.click()
        # time.sleep(10)

        # --- userCostHead (extract header names) ---
        user_cost_head = self.wait.until(EC.presence_of_element_located((By.ID, "userCostHead")))
        self.assertTrue(user_cost_head, "User Cost Head should be present")
        th_elements = user_cost_head.find_elements(By.TAG_NAME, "th")
        headers = [th.text.strip() for th in th_elements]
        expected_headers = ["USER EMAIL", "TODAY'S COST", "MONTHLY COST", "TOTAL COST"]
        for h in expected_headers:
            self.assertIn(h, headers, f"Expected header '{h}' not found in User Cost Head")

        # --- userCostBody ---
        user_cost_body = self.wait.until(EC.presence_of_element_located((By.ID, "userCostBody")))
        self.assertTrue(user_cost_body, "User Cost Body should be present")

        # --- userCostContainer ---
        user_cost_containers = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userCostContainer")))
        self.assertGreater(len(user_cost_containers), 0, "At least one User Cost Container should be present")

        # --- userEmailName (clickable, drop-down user info) ---
        user_email_names = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userEmailName")))
        for name in user_email_names:
            clickable_name = self.wait.until(EC.element_to_be_clickable((By.ID, "userEmailName")))
            self.assertTrue(clickable_name, "User Email Name should be clickable")
            clickable_name.click()
            time.sleep(0.5)

        # --- userEmailNameExtract ---
        extracted_names = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userEmailNameExtract")))
        self.assertGreater(len(extracted_names), 0, "At least one User Email Name Extract should be present")

        # --- userDailyCost / userMonthCost / userTotalCost ---
        daily_costs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userDailyCost")))
        self.assertGreater(len(daily_costs), 0, "At least one User Daily Cost should be present")

        month_costs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userMonthCost")))
        self.assertGreater(len(month_costs), 0, "At least one User Monthly Cost should be present")

        total_costs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userTotalCost")))
        self.assertGreater(len(total_costs), 0, "At least one User Total Cost should be present")

        # --- totalTokenCost ---
        total_token_cost = self.wait.until(EC.presence_of_element_located((By.ID, "totalTokenCost")))
        self.assertTrue(total_token_cost, "Total Token Cost should be present")

        # --- totalUsers, totalCost, avgCostUsers, topSpender, topSpenderName ---
        total_users = self.wait.until(EC.presence_of_element_located((By.ID, "totalUsers")))
        self.assertTrue(total_users, "Total Users should be present")

        total_cost = self.wait.until(EC.presence_of_element_located((By.ID, "totalCost")))
        self.assertTrue(total_cost, "Total Cost should be present")

        avg_cost_users = self.wait.until(EC.presence_of_element_located((By.ID, "avgCostUsers")))
        self.assertTrue(avg_cost_users, "Average Cost per User should be present")

        top_spender = self.wait.until(EC.presence_of_element_located((By.ID, "topSpender")))
        self.assertTrue(top_spender, "Top Spender should be present")

        top_spender_name = self.wait.until(EC.presence_of_element_located((By.ID, "topSpenderName")))
        self.assertTrue(top_spender_name, "Top Spender Name should be present")
        
    # ----------------- Test Total User Count on All Users Billing -----------------
    """This test ensures that Total User Count is equal to the represented number"""
    
    def test_check_user_count(self):
        
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)

        # --- Extract total user count from id="totalUsers" ---
        total_users_element = self.wait.until(EC.presence_of_element_located((By.ID, "totalUsers")))
        self.assertTrue(total_users_element, "Total Users element should be present")

        total_users_text = total_users_element.text.strip()
        self.assertTrue(total_users_text, "Total Users text should not be empty")

        # Convert string to float (hundredths place decimal)
        try:
            total_user_count = float(total_users_text)
        except ValueError:
            self.fail(f"Could not convert Total Users text '{total_users_text}' to float")

        # --- Count user cost containers ---
        user_cost_containers = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userCostContainer")))
        user_counted = len(user_cost_containers)

        # --- Assert equality ---
        self.assertEqual(
            user_counted,
            int(total_user_count),  # compare as integer count
            f"User count from containers ({user_counted}) should equal reported Total Users ({total_user_count})"
        )
        
    # ----------------- Test Total Cost on All Users Billing -----------------
    """This test ensures that Total Cost is equal to the represented costs"""
    
    def test_check_cost_on_all_users(self):
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)

        import re
        from decimal import Decimal, ROUND_HALF_UP, getcontext
        getcontext().rounding = ROUND_HALF_UP

        def parse_money(text: str) -> Decimal:
            # Strip $, commas, spaces, etc.; keep digits, dot, minus
            norm = re.sub(r"[^\d.\-]", "", (text or "").strip())
            self.assertTrue(norm not in {"", ".", "-", "-."}, f"Could not parse currency from '{text}'")
            # Quantize to cents with half-up to match typical currency display
            return Decimal(norm).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # --- totalCost (parse currency) ---
        total_cost_el = self.wait.until(EC.presence_of_element_located((By.ID, "totalCost")))
        self.assertTrue(total_cost_el, "Total Cost element should be present")
        total_cost_value = parse_money(total_cost_el.text)

        # --- userTotalCost (sum displayed per-user costs) ---
        per_user_cost_els = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userTotalCost")))
        self.assertGreater(len(per_user_cost_els), 0, "There should be at least one User Total Cost element")

        summed_displayed = sum(parse_money(el.text) for el in per_user_cost_els)

        # Allow ≤ $0.01 drift due to sum-then-round vs round-then-sum
        diff = (summed_displayed - total_cost_value).copy_abs()
        self.assertTrue(
            diff <= Decimal("0.01"),
            (
                f"Summed displayed user costs ({summed_displayed}) vs reported Total Cost ({total_cost_value}) "
                f"differ by {diff}; expected ≤ $0.01 (rounding drift)."
            ),
        )
        
    # ----------------- Test Avg Cost on All Users Billing -----------------
    """This test ensures that Avg Cost is equal to the represented costs"""
    
    def test_check_avg_cost_on_all_users(self):
        import re
        from decimal import Decimal, ROUND_HALF_UP, getcontext
        getcontext().rounding = ROUND_HALF_UP

        def parse_money(text: str) -> Decimal:
            # Strip $ and commas, keep digits, dot, minus
            norm = re.sub(r"[^\d.\-]", "", (text or "").strip())
            self.assertTrue(norm not in {"", ".", "-", "-."}, f"Could not parse currency from '{text}'")
            return Decimal(norm).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)

        # --- Extract displayed average cost ---
        avg_cost_el = self.wait.until(EC.presence_of_element_located((By.ID, "avgCostUsers")))
        self.assertTrue(avg_cost_el, "Avg Cost element should be present")
        avg_cost_displayed = parse_money(avg_cost_el.text)

        # --- Extract total users ---
        total_users_el = self.wait.until(EC.presence_of_element_located((By.ID, "totalUsers")))
        self.assertTrue(total_users_el, "Total Users element should be present")
        try:
            total_users_count = int(total_users_el.text.strip())
        except ValueError:
            self.fail(f"Could not parse Total Users text '{total_users_el.text.strip()}' as int")

        self.assertGreater(total_users_count, 0, "Total Users must be greater than zero to compute average")

        # --- Extract total cost ---
        total_cost_el = self.wait.until(EC.presence_of_element_located((By.ID, "totalCost")))
        self.assertTrue(total_cost_el, "Total Cost element should be present")
        total_cost_value = parse_money(total_cost_el.text)

        # --- Compute expected average ---
        expected_avg = (total_cost_value / Decimal(total_users_count)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # --- Assert displayed avg matches expected ---
        self.assertEqual(
            avg_cost_displayed,
            expected_avg,
            f"Displayed Avg Cost ({avg_cost_displayed}) does not match computed Avg Cost ({expected_avg})"
        )
        
    # ----------------- Test Top Spender on All Users Billing -----------------
    """This test ensures that Top Spender is represented correctly"""
    
    def test_check_top_spender_on_all_users(self):
    
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)
        
        # --- Extract displayed top spender info ---
        top_spender_amount_el = self.wait.until(EC.presence_of_element_located((By.ID, "topSpender")))
        top_spender_name_el = self.wait.until(EC.presence_of_element_located((By.ID, "topSpenderName")))

        self.assertTrue(top_spender_amount_el, "Top Spender amount element should be present")
        self.assertTrue(top_spender_name_el, "Top Spender name element should be present")

        top_spender_amount = top_spender_amount_el.text.strip()
        top_spender_name = top_spender_name_el.text.strip()
        top_spender_name = top_spender_name[:]

        # --- Get first user container ---
        user_containers = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userCostContainer")))
        self.assertGreater(len(user_containers), 0, "There should be at least one user container")

        first_user = user_containers[0]

        # Extract the first user's email and total cost
        user_email_el = first_user.find_element(By.ID, "userEmailNameExtract")
        user_total_cost_el = first_user.find_element(By.ID, "userTotalCost")

        self.assertTrue(user_email_el, "First user email element should be present")
        self.assertTrue(user_total_cost_el, "First user total cost element should be present")

        user_email = user_email_el.text.strip()
        user_total_cost = user_total_cost_el.text.strip()
        
        # If the email contains '@', substring to part before '@'; otherwise keep full string
        user_email_full = user_email_el.text.strip()
        if '@' in user_email_full:
            user_email = user_email_full.split('@')[0]
        else:
            user_email = user_email_full

        user_total_cost = user_total_cost_el.text.strip()

        # --- Assert top spender matches first user ---
        self.assertEqual(
            top_spender_name,
            user_email,
            f"Top Spender name ({top_spender_name}) should match first user's email ({user_email})"
        )
        self.assertEqual(
            top_spender_amount,
            user_total_cost,
            f"Top Spender amount ({top_spender_amount}) should match first user's total cost ({user_total_cost})"
        )
        
    # ----------------- Test Search on All Users Billing -----------------
    """This test ensures that search functionality in the All Users tab works correctly"""
    
    def test_check_search_on_all_users(self):
    
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)
        
        # --- SearchBar (send keys) ---
        search_bar = self.wait.until(EC.presence_of_element_located((By.ID, "SearchBar")))
        self.assertTrue(search_bar, "SearchBar should be present")
        
        time.sleep(1)
        search_bar.clear()
        time.sleep(1)
        search_bar.send_keys("charlie.perkins@vanderbilt.edu")
        time.sleep(3)
        
        # --- Collect all userEmailNameExtract elements ---
        elements = self.driver.find_elements(By.ID, "userEmailNameExtract")
        self.assertGreater(len(elements), 0, "Expected at least one userEmailNameExtract element")
        
        # Extract text and check each contains "charlie.perkins@vanderbilt.edu"
        for elem in elements:
            text = elem.text.strip()
            self.assertIn("charlie.perkins@vanderbilt.edu", text, f"Expected 'charlie.perkins@vanderbilt.edu' in element text, got: {text}")
        
    # ----------------- Test Click on User in All Users Billing -----------------
    """This test ensures that account table for a user in the All Users tab is visible"""
    
    def test_check_for_account_table(self):
    
        time.sleep(3)
        self.billing_and_cost_management_menu_open()
        time.sleep(2)
        
        user_containers = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userCostContainer")))
        self.assertGreater(len(user_containers), 0, "There should be at least one user container")

        first_user = user_containers[0]
        
        user_email_el = first_user.find_element(By.ID, "userEmailName")
        self.assertTrue(user_email_el, "First user email element should be present")
        
        time.sleep(2)
        user_email_el.click()
        time.sleep(2)

        account_table = self.wait.until(EC.presence_of_element_located((By.ID, "accountTable")))
        self.assertTrue(account_table, "Account Table should be present")
    
    # ----------------- Test Presence on Billing Groups Tab -----------------
    """This test ensures that search functionality in the All Users tab works correctly"""
    
    def test_presence_on_billing_groups(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        # --- SearchBar (send keys) ---
        search_bar = self.wait.until(EC.presence_of_element_located((By.ID, "SearchBar")))
        self.assertTrue(search_bar, "SearchBar should be present")

        # --- downloadCSVButton (clickable) ---
        download_csv_button = self.wait.until(EC.element_to_be_clickable((By.ID, "downloadCSVButton")))
        self.assertTrue(download_csv_button, "Download CSV Button should be clickable")

        # --- refreshDataButton (clickable, click, sleep) ---
        refresh_data_button = self.wait.until(EC.element_to_be_clickable((By.ID, "refreshDataButton")))
        self.assertTrue(refresh_data_button, "Refresh Data Button should be clickable")
        refresh_data_button.click()
        time.sleep(10)
        
        # --- Billing Group Credentials ---
        billing_group_container = self.wait.until(EC.presence_of_all_elements_located((By.ID, "billingGroupContainer")))
        self.assertGreater(len(billing_group_container), 0, "At least one User Group should be present")
        
        billing_group_name = self.wait.until(EC.presence_of_all_elements_located((By.ID, "billingGroupName")))
        self.assertTrue(billing_group_name, "Group Name should be present")
        
        billing_group_cost = self.wait.until(EC.presence_of_all_elements_located((By.ID, "billingGroupCost")))
        self.assertTrue(billing_group_cost, "Group Cost should be present")
        
        direct_member_number = self.wait.until(EC.presence_of_all_elements_located((By.ID, "directMemberNumber")))
        self.assertTrue(direct_member_number, "Direct Member Number should be present")

        indirect_member_number = self.wait.until(EC.presence_of_all_elements_located((By.ID, "indirectMemberNumber")))
        self.assertTrue(indirect_member_number, "Indirect Member Number should be present")
        
        total_member_number = self.wait.until(EC.presence_of_all_elements_located((By.ID, "totalMemberNumber")))
        self.assertTrue(total_member_number, "Total Member Number should be present")
        
        daily_cost_number = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dailyCostNumber")))
        self.assertTrue(daily_cost_number, "Daily Cost Number should be present")
        
        monthly_cost_number = self.wait.until(EC.presence_of_all_elements_located((By.ID, "monthlyCostNumber")))
        self.assertTrue(monthly_cost_number, "Monthly Cost Number should be present")
        
        avg_cost_per_member_number = self.wait.until(EC.presence_of_all_elements_located((By.ID, "avgCostPerMemberNumber")))
        self.assertTrue(avg_cost_per_member_number, "Avg Cost Per Member Number should be present")

        # --- totalTokenCost ---
        total_token_cost = self.wait.until(EC.presence_of_element_located((By.ID, "totalTokenCost")))
        self.assertTrue(total_token_cost, "Total Token Cost should be present")

        # --- totalBillingGroupsNumber, totalUsersNumber, topGroupSpenderName, topGroupSpender ---
        total_user_groups = self.wait.until(EC.presence_of_element_located((By.ID, "totalBillingGroupsNumber")))
        self.assertTrue(total_user_groups, "Total Groups Number should be present")

        total_user_number = self.wait.until(EC.presence_of_element_located((By.ID, "totalUsersNumber")))
        self.assertTrue(total_user_number, "Total User Number should be present")

        top_group_spender_name = self.wait.until(EC.presence_of_element_located((By.ID, "topGroupSpenderName")))
        self.assertTrue(top_group_spender_name, "Top Spender Name should be present")

        top_group_spender = self.wait.until(EC.presence_of_element_located((By.ID, "topGroupSpender")))
        self.assertTrue(top_group_spender, "Top Spender value should be present")
        
    # ----------------- Test Total Billing Groups Count -----------------
    """This test ensures that search functionality in the All Users tab works correctly"""
    
    def test_billing_groups_count(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        # --- Extract total group count from id="totalBillingGroupsNumber" ---
        total_group_element = self.wait.until(EC.presence_of_element_located((By.ID, "totalBillingGroupsNumber")))
        self.assertTrue(total_group_element, "Total Users element should be present")

        total_group_number = total_group_element.text.strip()
        self.assertTrue(total_group_number, "Total Users text should not be empty")

        # Convert string to int
        try:
            total_user_count = int(total_group_number)
        except ValueError:
            self.fail(f"Could not convert Total Groups text '{total_group_number}' to int")

        # --- Count user cost containers ---
        group_containers = self.wait.until(EC.presence_of_all_elements_located((By.ID, "billingGroupContainer")))
        user_counted = len(group_containers)

        # --- Assert equality ---
        self.assertEqual(
            user_counted,
            total_user_count,  # compare as integer count
            f"User count from containers ({user_counted}) should equal reported Total Users ({total_user_count})"
        )
        
    # ----------------- Test Billing Groups Top Spender -----------------
    """This test ensures that Top Spender is represented correctly"""
    
    def test_billing_groups_top_spender(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        # --- Extract displayed top spender info ---
        top_spender_amount_el = self.wait.until(EC.presence_of_element_located((By.ID, "topGroupSpender")))
        top_spender_name_el = self.wait.until(EC.presence_of_element_located((By.ID, "topGroupSpenderName")))

        self.assertTrue(top_spender_amount_el, "Top Spender amount element should be present")
        self.assertTrue(top_spender_name_el, "Top Spender name element should be present")

        top_spender_amount = top_spender_amount_el.text.strip()
        top_spender_names = top_spender_name_el.text.strip()

        # --- Split multiple names if they exist ---
        top_spender_name_list = [n.strip() for n in top_spender_names.split("•")]

        # --- Get all group containers ---
        group_containers = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "billingGroupContainer"))
        )
        self.assertGreater(len(group_containers), 0, "There should be at least one group container")

        # --- Loop over containers and verify ---
        matched_groups = []
        for container in group_containers:
            group_name_el = container.find_element(By.ID, "billingGroupName")
            group_cost_el = container.find_element(By.ID, "billingGroupCost")

            group_name = group_name_el.text.strip()
            group_cost = group_cost_el.text.strip()

            if group_name in top_spender_name_list:
                # Cost must match the top spender amount
                self.assertEqual(
                    top_spender_amount,
                    group_cost,
                    f"Top spender amount ({top_spender_amount}) should match cost for group {group_name} ({group_cost})"
                )
                matched_groups.append(group_name)

        # --- Ensure all listed top spenders were validated ---
        self.assertEqual(
            set(top_spender_name_list),
            set(matched_groups),
            f"Not all top spender names were matched in the billing groups. Expected {top_spender_name_list}, got {matched_groups}"
        )
        
    # ----------------- Test Billing Groups Total Cost -----------------
    """This test ensures that Top Spender is represented correctly"""
    
    def test_billing_groups_total_cost(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        import re
        from decimal import Decimal, ROUND_HALF_UP, getcontext
        getcontext().rounding = ROUND_HALF_UP

        def parse_money(text: str) -> Decimal:
            # Strip $, commas, spaces, etc.; keep digits, dot, minus
            norm = re.sub(r"[^\d.\-]", "", (text or "").strip())
            self.assertTrue(norm not in {"", ".", "-", "-."}, f"Could not parse currency from '{text}'")
            # Quantize to cents with half-up to match typical currency display
            return Decimal(norm).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        # --- Get all group containers ---
        group_containers = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "billingGroupContainer"))
        )
        self.assertGreater(len(group_containers), 0, "There should be at least one group container")
        
        test_group = group_containers[0]

        test_group_cost = test_group.find_element(By.ID, "billingGroupCost")
        group_cost = parse_money(test_group_cost.text)
        
        expand_group_button = test_group.find_element(By.ID, "expandMembersList")
        expand_group_button.click()
        time.sleep(3)
        
        # --- userInGroupCost (sum displayed per-user costs) ---
        per_user_cost_els = self.wait.until(EC.presence_of_all_elements_located((By.ID, "userInGroupCost")))
        self.assertGreater(len(per_user_cost_els), 0, "There should be at least one User Total Cost element")

        summed_displayed = sum(parse_money(el.text) for el in per_user_cost_els)

        # Allow ≤ $0.01 drift due to sum-then-round vs round-then-sum
        diff = (summed_displayed - group_cost).copy_abs()
        self.assertTrue(
            diff <= Decimal("0.01"),
            (
                f"Summed displayed user costs ({summed_displayed}) vs reported Total Cost ({group_cost}) "
                f"differ by {diff}; expected ≤ $0.01 (rounding drift)."
            ),
        )
        
    # ----------------- Test Billing Groups Average Costs -----------------
    """This test ensures that Top Spender is represented correctly"""
    
    def test_billing_groups_average_cost(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        import re
        from decimal import Decimal, ROUND_HALF_UP, getcontext
        getcontext().rounding = ROUND_HALF_UP

        def parse_money(text: str) -> Decimal:
            # Strip $, commas, spaces, etc.; keep digits, dot, minus
            norm = re.sub(r"[^\d.\-]", "", (text or "").strip())
            self.assertTrue(norm not in {"", ".", "-", "-."}, f"Could not parse currency from '{text}'")
            # Quantize to cents with half-up to match typical currency display
            return Decimal(norm).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        # --- Get all group containers ---
        group_containers = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "billingGroupContainer"))
        )
        self.assertGreater(len(group_containers), 0, "There should be at least one group container")
        
        test_group = group_containers[0]

        test_group_average_cost = test_group.find_element(By.ID, "avgCostPerMemberNumber")
        group_average_cost = parse_money(test_group_average_cost.text)
        
        test_group_cost = test_group.find_element(By.ID, "billingGroupCost")
        group_cost = parse_money(test_group_cost.text)
        
        test_group_member_number = test_group.find_element(By.ID, "totalMemberNumber")
        group_member_number = Decimal(test_group_member_number.text)
        
        # --- Compute expected average ---
        expected_avg = (group_cost / group_member_number).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # --- Assert displayed avg matches expected ---
        self.assertEqual(
            group_average_cost,
            expected_avg,
            f"Displayed Avg Cost ({group_average_cost}) does not match computed Avg Cost ({expected_avg})"
        )
        
    # ----------------- Test Billing Groups Indirect Plus Direct -----------------
    """This test ensures that indirect plus direct is represented correctly"""
    
    def test_billing_groups_indirect_plus_direct(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        # --- Get all group containers ---
        group_containers = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "billingGroupContainer"))
        )
        self.assertGreater(len(group_containers), 0, "There should be at least one group container")
        
        test_group = group_containers[0]
        
        test_direct_group_member_number = test_group.find_element(By.ID, "directMemberNumber")
        direct_group_member_number = int(test_direct_group_member_number.text)
        
        test_indirect_group_member_number = test_group.find_element(By.ID, "indirectMemberNumber")
        indirect_group_member_number = int(test_indirect_group_member_number.text)
        
        test_total_group_member_number = test_group.find_element(By.ID, "totalMemberNumber")
        total_group_member_number = int(test_total_group_member_number.text)
        
        group_number_expected = direct_group_member_number + indirect_group_member_number
        
        # --- Assert displayed matches expected ---
        self.assertEqual(
            total_group_member_number,
            group_number_expected,
            f"Displayed Avg Cost ({total_group_member_number}) does not match computed ({group_number_expected})"
        )
        
    # ----------------- Test Billing Groups Search -----------------
    """This test ensures that the search function works correctly"""
    
    def test_billing_groups_search(self):
    
        time.sleep(1)
        self.billing_group_tab_open()
        time.sleep(1)
        
        # --- SearchBar (send keys) ---
        search_bar = self.wait.until(EC.presence_of_element_located((By.ID, "SearchBar")))
        self.assertTrue(search_bar, "SearchBar should be present")
        
        time.sleep(1)
        search_bar.clear()
        time.sleep(1)
        search_bar.send_keys("Admins")
        time.sleep(3)
        
        # --- Collect all billingGroupName elements ---
        elements = self.driver.find_elements(By.ID, "billingGroupName")
        self.assertGreater(len(elements), 0, "Expected at least one billingGroupName element")
        
        # Extract text and check each contains "Admins"
        for elem in elements:
            text = elem.text.strip()
            self.assertIn("Admins", text, f"Expected 'Admins' in element text, got: {text}")
        
if __name__ == "__main__":
    unittest.main(verbosity=2)
