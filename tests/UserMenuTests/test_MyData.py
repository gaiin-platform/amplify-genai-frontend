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
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest


class MyDataTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    def user_menu_my_data_open(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "User Menu Button should be initialized")

        user_menu_button.click()
        
        time.sleep(2)
        
        my_data_button = self.wait.until(EC.element_to_be_clickable((By.ID, "myDataFiles")))
        self.assertTrue(my_data_button, "User Menu Button should be initialized")

        my_data_button.click()
        
        time.sleep(10) # Extra time to load
        
    def upload_file(self, filename):
        print("Starting upload_file function...")
        if not filename:
            print("Filename is empty or None!")
            return

        file_path = os.path.join(os.path.dirname(__file__), "..", "test_files", filename)
        file_path = os.path.normpath(file_path)
        # print(f"Resolved absolute file path: {file_path}")

        # Ensure the file exists
        if not os.path.exists(file_path):
            print(f"File does NOT exist: {file_path}")
            return
        else:
            print("File exists!")
        
        # print(f"Uploading file: {file_path}")
        
        file_input = self.driver.find_element(By.ID, "__attachFile")
        self.driver.execute_script("arguments[0].classList.remove('sr-only');", file_input)
        self.driver.execute_script("arguments[0].style.display = 'block';", file_input)
        # print("Sending file to input field...")
        file_input.send_keys(file_path)
        time.sleep(35)
        
    def get_column_actions_button(self, column_title: str, timeout: int = 12):
        """
        Find the "Column Actions" button for a given column header title (e.g. "Name").
        Returns the clickable WebElement or raises AssertionError with debug info.
        """
        print(f"[DEBUG] get_column_actions_button: looking for column '{column_title}'")

        # XPath pieces:
        # 1) header wrapper: div with title and exact text "Name"
        header_xpath = ("//div[@title=\"{0}\" and normalize-space(text())=\"{0}\"]").format(column_title)

        # 2) climb to the top header container for that column (class token used)
        container_xpath = header_xpath + "/ancestor::div[contains(@class,'mantine-TableHeadCell-Content mantine-')][1]"

        # 3) find the Column Actions button inside that container
        button_xpath = container_xpath + "//button[@aria-label='Column Actions']"

        try:
            print(f"[DEBUG] Waiting for clickable button using XPath:\n{button_xpath}")
            btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, button_xpath)))
            print("[DEBUG] Found clickable button. outerHTML (truncated):")
            print(btn.get_attribute("outerHTML")[:400])
            return btn
        except Exception as e:
            # gather debug info to help you inspect the DOM
            print(f"[ERROR] Could not locate clickable Column Actions button for '{column_title}': {e}")

            # Try to at least dump the header wrapper outerHTML (if present)
            try:
                header_el = self.driver.find_element(By.XPATH, header_xpath)
                print("[DEBUG] Header wrapper outerHTML:")
                print(header_el.get_attribute("outerHTML")[:800])
            except Exception as he:
                print(f"[DEBUG] Header wrapper not found via XPath {header_xpath}: {he}")

            # Try to dump the container outerHTML (if present)
            try:
                container_el = self.driver.find_element(By.XPATH, container_xpath)
                print("[DEBUG] Container outerHTML:")
                print(container_el.get_attribute("outerHTML")[:1200])
            except Exception as ce:
                print(f"[DEBUG] Container not found via XPath {container_xpath}: {ce}")

            # save screenshot
            try:
                os.makedirs("/tmp", exist_ok=True)
                shot = f"/tmp/column_actions_{column_title.replace(' ', '_')}.png"
                self.driver.save_screenshot(shot)
                print(f"[DEBUG] Screenshot saved to: {shot}")
            except Exception as se:
                print(f"[DEBUG] Failed to save screenshot: {se}")

            # Final helpful suggestion in the error message
            raise AssertionError(
                f"Couldn't find clickable Column Actions button for '{column_title}'. "
                f"See debug logs and screenshot (if created). Original error: {e}"
            ) from e
        

    # ----------------- Test Presence of Data Table ------------------
    """This will test ensure all of the elements in the My Data Table are present and clickable"""
    
    def test_presence_in_user_menu(self):
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        your_files = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
        self.assertTrue(your_files, "Your Files Text is present")
    
        # --- Top action buttons ---
        search_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide search']")))
        self.assertTrue(search_btn, "Show/Hide search Button is clickable")

        filter_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide filters']")))
        self.assertTrue(filter_btn, "Show/Hide filters Button is clickable")

        columns_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide columns']")))
        self.assertTrue(columns_btn, "Show/Hide columns Button is clickable")

        density_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Toggle density']")))
        self.assertTrue(density_btn, "Toggle density Button is clickable")


        # --- File sort section ---
        name_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Name']")))
        self.assertTrue(name_title, "Name Column Header is displayed")

        created_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Created']")))
        self.assertTrue(created_title, "Created Column Header is displayed")

        tags_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Tags']")))
        self.assertTrue(tags_title, "Tags Column Header is displayed")

        type_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Type']")))
        self.assertTrue(type_title, "Type Column Header is displayed")

        for col in ("Name", "Created", "Type"):
            btn = self.get_column_actions_button(col, timeout=12)
            self.assertTrue(btn.is_displayed(), f"'{col}' column actions should be visible")

        # --- Row action buttons ---
        download_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[title='Download File']")))
        self.assertTrue(download_btn, "Download File Button is clickable")

        add_tag_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addTag")))
        self.assertTrue(add_tag_btn, "Download File Button is clickable")

        delete_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[title='Delete File']")))
        self.assertTrue(delete_btn, "Delete File Button is clickable")

    # ----------------- Test Column Action Button Clicks ------------------
    """This will test ensure all of the Column Action Button in the My Data Table are clickable
       and display the appropriate menus"""
    
    def test_column_action_buttons(self):
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        # Map column names to expected menu items
        expected_menus = {
            "Name": ["Clear filter", "Filter by Name", "Reset column size", "Hide Name column", "Show all columns"],
            "Created": ["Reset column size", "Hide Created column", "Show all columns"],
            "Type": ["Clear filter", "Filter by Type", "Reset column size", "Hide Type column", "Show all columns"]
        }

        for column_name in expected_menus.keys():
            # Find the column header container for this column
            header_container = self.wait.until(
                EC.presence_of_element_located(
                    (By.XPATH, f"//div[contains(@class,'mantine-TableHeadCell-Content') and .//div[@title='{column_name}']]")
                )
            )
            # Find and click the Column Actions button
            column_button = header_container.find_element(By.XPATH, ".//button[@aria-label='Column Actions']")
            self.wait.until(EC.element_to_be_clickable(column_button)).click()
            time.sleep(2)  # wait for dropdown animation

            # Wait for the dropdown menu to appear
            menu = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[class*='mantine-Menu-dropdown']"))
            )

            # Find all menu items inside the dropdown
            menu_items = menu.find_elements(By.CSS_SELECTOR, "button[class*='mantine-Menu-item']")
            extracted_labels = []

            for item in menu_items:
                label = item.find_element(By.CSS_SELECTOR, "div[class*='mantine-Menu-itemLabel']").text.strip()
                extracted_labels.append(label)

            print(f"[DEBUG] Extracted menu for '{column_name}' column: {extracted_labels}")

            # Compare with expected menu items
            self.assertEqual(
                extracted_labels,
                expected_menus[column_name],
                f"Dropdown menu for '{column_name}' column does not match expected items"
            )

            # Optional: click outside to close the menu before next iteration
            self.driver.find_element(By.TAG_NAME, "body").click()
            time.sleep(2)
            
    # ----------------- Test Search Button ------------------
    """This will test ensure all of the elements in the My Data Table are present and clickable"""
    
    def test_search_button_in_my_data(self):
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        your_files = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
        self.assertTrue(your_files, "Your Files Text is present")
        
        search_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide search']")))
        self.assertTrue(search_btn, "Show/Hide search Button is clickable")
        
        search_btn.click()
        
        time.sleep(3)
        
        # Wait for the dropdown menu to appear
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input.mantine-Input-input.mantine-TextInput-input"))
        )
        self.assertTrue(search_bar, "Search Bar input is present")
        
        time.sleep(1)
        
        search_bar.clear()
        
        time.sleep(1)

        search_bar.send_keys("Howddyyyyy")
        
        time.sleep(5)
        
        # Verify the value inside the search bar
        entered_value = search_bar.get_attribute("value")
        self.assertEqual(entered_value, "Howddyyyyy", "Search bar contains the correct value")
        
    # ----------------- Test Filter Button ------------------
    """This will test ensure all of the elements in the My Data Table are present and clickable"""
    
    def test_filter_button_in_my_data(self):
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        your_files = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
        self.assertTrue(your_files, "Your Files Text is present")  
        
        name_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Name']")))
        self.assertTrue(name_filter, "Name Column Filter is displayed")
        
        tag_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Tags']")))
        self.assertTrue(tag_filter, "Tag Column Filter is displayed")
        
        type_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Type']")))
        self.assertTrue(type_filter, "Type Column Filter is displayed")
        
        filter_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide filters']")))
        self.assertTrue(filter_btn, "Show/Hide filters Button is clickable")
        
        filter_btn.click()
        
        time.sleep(3)
        
        name_filter = self.wait.until(EC.invisibility_of_element((By.CSS_SELECTOR, "[title='Filter by Name']")))
        self.assertTrue(name_filter, "Name Column Filter is displayed")
        
        tag_filter = self.wait.until(EC.invisibility_of_element((By.CSS_SELECTOR, "[title='Filter by Tags']")))
        self.assertTrue(tag_filter, "Tag Column Filter is displayed")
        
        type_filter = self.wait.until(EC.invisibility_of_element((By.CSS_SELECTOR, "[title='Filter by Type']")))
        self.assertTrue(type_filter, "Type Column Filter is displayed")
    
        filter_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide filters']")))
        self.assertTrue(filter_btn, "Show/Hide filters Button is clickable")
        
        filter_btn.click()
        
        time.sleep(3)
        
        name_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Name']")))
        self.assertTrue(name_filter, "Name Column Filter is displayed")
        
        tag_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Tags']")))
        self.assertTrue(tag_filter, "Tag Column Filter is displayed")
        
        type_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Type']")))
        self.assertTrue(type_filter, "Type Column Filter is displayed")
        
    # ----------------- Test Search and Filter Input ------------------
    """This will test ensure all of the elements in the My Data Table are present and clickable"""
    
    def test_search_and_filter_input_in_my_data(self):
        
        time.sleep(8)
        
        self.upload_file("Test_Buck.html")
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        your_files = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
        self.assertTrue(your_files, "Your Files Text is present") 
        
        search_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide search']")))
        self.assertTrue(search_btn, "Show/Hide search Button is clickable")
        
        search_btn.click()
        
        time.sleep(3)
        
        name_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Name']")))
        self.assertTrue(name_filter, "Name Column Filter is displayed")
        
        tag_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Tags']")))
        self.assertTrue(tag_filter, "Tag Column Filter is displayed")
        
        type_filter = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Filter by Type']")))
        self.assertTrue(type_filter, "Type Column Filter is displayed")
        
        filter_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide filters']")))
        self.assertTrue(filter_btn, "Show/Hide filters Button is clickable")
        
        time.sleep(3)
        
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input.mantine-Input-input.mantine-TextInput-input"))
        )
        self.assertTrue(search_bar, "Search Bar input is present")
        
        time.sleep(1)
        
        search_bar.clear()
        
        time.sleep(1)

        search_bar.send_keys("Test_Buck")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        # Add Tag
        add_tag = self.wait.until(EC.presence_of_element_located((By.ID, "addTag")))
        self.assertTrue(add_tag, "Add Tag button should be initialized")
        add_tag.click()
        
        time.sleep(3)
    
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Bee, Koraidon")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input.mantine-Input-input.mantine-TextInput-input"))
        )
        self.assertTrue(search_bar, "Search Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear search']")))
        self.assertTrue(clear_btn, "Clear search Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)
        
        name_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Name']"))
        )
        self.assertTrue(name_filter_bar, "Name Filter Bar input is present")
        
        time.sleep(1)
        
        name_filter_bar.clear()
        
        time.sleep(1)
        
        name_filter_bar.send_keys("Test_Buck")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        name_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Name']"))
        )
        self.assertTrue(name_filter_bar, "Name Filter Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear filter']")))
        self.assertTrue(clear_btn, "Clear filter Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)

        # Filter By Tag
        
        tag_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Tags']"))
        )
        self.assertTrue(tag_filter_bar, "Tag Filter Bar input is present")
        
        time.sleep(1)
        
        tag_filter_bar.clear()
        
        time.sleep(1)
        
        tag_filter_bar.send_keys("Koraidon")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        tag_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Tags']"))
        )
        self.assertTrue(tag_filter_bar, "Tag Filter Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear filter']")))
        self.assertTrue(clear_btn, "Clear filter Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)
        
        tag_filter_bar.send_keys("Bee")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        tag_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Tags']"))
        )
        self.assertTrue(tag_filter_bar, "Tag Filter Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear filter']")))
        self.assertTrue(clear_btn, "Clear filter Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)
        
        tag_filter_bar.send_keys("Koraidon, Bee")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        tag_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Tags']"))
        )
        self.assertTrue(tag_filter_bar, "Tag Filter Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear filter']")))
        self.assertTrue(clear_btn, "Clear filter Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)

        # Filter By Type
        
        type_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Type']"))
        )
        self.assertTrue(type_filter_bar, "Type Filter Bar input is present")
        
        time.sleep(1)
        
        type_filter_bar.clear()
        
        time.sleep(1)
        
        type_filter_bar.send_keys("HTML")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        type_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Type']"))
        )
        self.assertTrue(type_filter_bar, "Type Filter Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear filter']")))
        self.assertTrue(clear_btn, "Clear filter Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)

        # Delete Data
        
        name_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Name']"))
        )
        self.assertTrue(name_filter_bar, "Name Filter Bar input is present")
        
        time.sleep(1)
        
        name_filter_bar.clear()
        
        time.sleep(1)
        
        name_filter_bar.send_keys("Test_Buck")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_Buck.html should be present in the files table.")
        
        time.sleep(3)
        
        delete_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[title='Delete File']")))
        self.assertTrue(delete_btn, "Delete File Button is clickable")
        
        delete_btn.click()
        
        time.sleep(10)
        
        # Look for absence
        
        name_filter_bar = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='Filter by Name']"))
        )
        self.assertTrue(name_filter_bar, "Name Filter Bar input is present")
        
        time.sleep(1)
        
        clear_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Clear filter']")))
        self.assertTrue(clear_btn, "Clear filter Button is clickable")
        
        clear_btn.click()
        
        time.sleep(10)
        
        name_filter_bar.send_keys("Test_Buck")
        
        time.sleep(10)
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_Buck.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_Buck.html":
                    found = True
                    break
            if found:
                break

        self.assertFalse(found, "Test_Buck.html should NOT be present in the files table.")
        
        time.sleep(3)
        
    def test_show_hide_columns_in_my_data(self):
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        your_files = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
        self.assertTrue(your_files, "Your Files Text is present")
        
        time.sleep(2)
        
        name_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Name']")))
        self.assertTrue(name_title, "Name Column Header is displayed")

        created_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Created']")))
        self.assertTrue(created_title, "Created Column Header is displayed")

        tags_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Tags']")))
        self.assertTrue(tags_title, "Tags Column Header is displayed")

        type_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Type']")))
        self.assertTrue(type_title, "Type Column Header is displayed")
        
        # Show/Hide columns
        time.sleep(1)
        
        show_hide_columns_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Show/Hide columns']")))
        self.assertTrue(show_hide_columns_btn, "Show/Hide columns Button is clickable")
        
        show_hide_columns_btn.click()
        
        time.sleep(3)
        
        # Helper: click switch by its label text and verify invisibility of corresponding header
        def click_and_verify_invisible(label_text, header_title):
            # Click the switch
            switch = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, f"//span[contains(@class,'mantine-Switch-label')][normalize-space(text())='{label_text}']"))
            )
            switch.click()
            time.sleep(3)  # allow UI update
            
            # Verify header is now invisible
            self.wait.until(
                EC.invisibility_of_element_located((By.CSS_SELECTOR, f"[title='{header_title}']"))
            )
            # We got here without Timeout -> passed
            self.assertTrue(True, f"{header_title} column is hidden as expected")

        # Click each switch and verify
        click_and_verify_invisible("Name", "Name")
        click_and_verify_invisible("Created", "Created")
        click_and_verify_invisible("Tags", "Tags")
        click_and_verify_invisible("Type", "Type")
        
        # Hide all
        time.sleep(2)
        
        # Click "Hide all" button
        hide_all_btn = self.wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[.//span[normalize-space(text())='Hide all']]"))
        )
        self.assertTrue(hide_all_btn, "'Hide all' button is clickable")
        hide_all_btn.click()
        time.sleep(5)  # allow UI update
        
        name_title = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Name']")))
        self.assertTrue(name_title, "Name Column Header is not displayed")

        created_title = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Created']")))
        self.assertTrue(created_title, "Created Column Header is not displayed")

        tags_title = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Tags']")))
        self.assertTrue(tags_title, "Tags Column Header is not displayed")

        type_title = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Type']")))
        self.assertTrue(type_title, "Type Column Header is not displayed")
        
        download_button = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Download File']")))
        self.assertTrue(download_button, "Download Button is not displayed")

        delete_file_button = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Delete File']")))
        self.assertTrue(delete_file_button, "Delete Button is not displayed")

        regenerate_text = self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "[title='Regenerate text extraction and embeddings for this file.']")))
        self.assertTrue(regenerate_text, "Regenerate Text Button is not displayed")
        
        time.sleep(2)
        
        # Show all
        show_all_btn = self.wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[.//span[normalize-space(text())='Show all']]"))
        )
        self.assertTrue(show_all_btn, "'Show all' button is clickable")
        show_all_btn.click()
        time.sleep(5)  # allow UI update

        name_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Name']")))
        self.assertTrue(name_title, "Name Column Header is displayed")

        created_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Created']")))
        self.assertTrue(created_title, "Created Column Header is displayed")

        tags_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Tags']")))
        self.assertTrue(tags_title, "Tags Column Header is displayed")

        type_title = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Type']")))
        self.assertTrue(type_title, "Type Column Header is displayed")
        
        download_button = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Download File']")))
        self.assertTrue(download_button, "Download Button is displayed")

        delete_file_button = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Delete File']")))
        self.assertTrue(delete_file_button, "Delete Button is displayed")

        regenerate_text = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[title='Regenerate text extraction and embeddings for this file.']")))
        self.assertTrue(regenerate_text, "Regenerate Text Button is displayed")
        
        time.sleep(2)
        
    def test_toggle_density_columns_in_my_data(self):
        
        time.sleep(3)
        
        self.user_menu_my_data_open()
        
        time.sleep(2)
        
        your_files = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
        self.assertTrue(your_files, "Your Files Text is present")
        
        time.sleep(2)
        
        density_btn = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Toggle density']")))
        self.assertTrue(density_btn, "Toggle density Button is clickable")
        
        density_btn.click()
        
        time.sleep(1)
        
        density_btn.click()
        
        time.sleep(1)
        
        density_btn.click()
        
        time.sleep(3)

if __name__ == "__main__":
    unittest.main(verbosity=2)

    
    