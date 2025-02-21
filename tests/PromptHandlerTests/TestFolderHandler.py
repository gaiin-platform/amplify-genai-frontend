import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException, NoSuchElementException
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys

class CreateFolderTests(unittest.TestCase):
    
    # ----------------- Setup -----------------
    def setUp(self, headless=False):
        
        # Load environment variables from .env.local
        load_dotenv(".env.local")

        # Get values from environment variables
        base_url = os.getenv("NEXTAUTH_URL", "http://localhost:3000")
        username = os.getenv("SELENIUM_USERNAME", "default_username")
        password = os.getenv("SELENIUM_PASSWORD", "default_password")
        
        # Configure Chrome options based on headless parameter
        options = webdriver.ChromeOptions()
        if headless:
            options.add_argument("--headless")  # Run browser in headless mode
            options.add_argument("--disable-gpu")  # Disable GPU acceleration
            options.add_argument("--window-size=1920,1080")  # Set window size
        
        # Initialize WebDriver with the configured options
        self.driver = webdriver.Chrome(options=options if headless else None)
        self.driver.get(base_url)
        self.wait = WebDriverWait(self.driver, 10)
        self.login(username, password)  # Perform login during setup

    def tearDown(self):
        self.driver.quit()
        
    # ----------------- Login -----------------
    def login(self, username, password):
        """Helper method to perform login."""
        try:
            # Click the login button to reveal the login form
            login_button = self.wait.until(EC.element_to_be_clickable(
                (By.ID, "loginButton")
            ))
            login_button.click()

            # Wait for the username and password fields to appear
            username_field = self.wait.until(lambda d: next(
                (e for e in d.find_elements(By.NAME, "username") if e.is_displayed()), None
            ))
            password_field = self.wait.until(lambda d: next(
                (e for e in d.find_elements(By.NAME, "password") if e.is_displayed()), None
            ))

            # Enter username and password
            username_field.send_keys(username)
            password_field.send_keys(password)

            # Submit the login form            
            form = self.driver.find_element(By.TAG_NAME, "form")
            form.submit()
            
            # Add a short delay to wait for the loading screen
            time.sleep(8)  # Wait for 8 seconds before proceeding

            # Wait for a post-login element to ensure login was successful
            self.wait.until(EC.visibility_of_element_located(
                (By.ID, "messageChatInputText")  # Sidebar appears
            ))
        except Exception as e:
            self.fail(f"Login failed: {e}")   
            
            
    # ----------------- Setup Test Data ------------------
    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")
        folder_add_buttons[-1].click()
        
        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.send_keys(folder_name)
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
            
            
    def create_assistant(self, assistant_name):
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantName")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys(assistant_name)
        
        assistant_save_button = self.wait.until(EC.element_to_be_clickable((By.ID, "saveButton")))
        self.assertIsNotNone(assistant_save_button, "Save button should be initialized and clickable")
        assistant_save_button.click()
        
        time.sleep(5)
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")
        
        # Ensure the parent button's title is "Collapse folder" before clicking
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
        
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        assistant_in_list = next((el for el in prompt_name_elements if el.text == assistant_name), None)
        self.assertIsNotNone(assistant_in_list, f"{assistant_name} should be visible in the dropdown")
            

    
    # ----------------- Test Folder Sort Name -----------------
    def test_folder_sort_name(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear

        # Hover over the first visibleSubMenu
        visible_sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "visibleSubMenu")))
        ActionChains(self.driver).move_to_element(visible_sub_menu).perform()
        time.sleep(1)

        # Hover over the second subMenu (nested one)
        nested_sub_menu = self.wait.until(EC.presence_of_all_elements_located((By.ID, "subMenu")))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        ActionChains(self.driver).move_to_element(nested_sub_menu[-1]).perform()
        time.sleep(1)

        # Click the button with ID "Name"
        button = self.wait.until(EC.element_to_be_clickable((By.ID, "Name")))
        button.click()
        
        time.sleep(3)
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract text from all elements and strip whitespace
        drop_names = [element.text.strip() for element in drop_name_elements]

        # Ensure the list is sorted in ascending order
        self.assertEqual(drop_names, sorted(drop_names), "Drop name elements should be sorted alphabetically")

    
    # id="Name"
    # id="Date"
    # id="Delete"
    # id="Share"
    # id="Clean"
    # id="Open All"
    # id="Close All"
    
    
    # ----------------- Test Folder Sort Date -----------------
    # HELD OFF FOR NOW, MIGHT INCLUDE BACKEND
    
    # ----------------- Test Folder Delete -----------------
    def test_folder_delete(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Delete"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Delete")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Check if any of the elements contain "Goomba 1"
        folder_in_list = next((el for el in drop_name_elements if el.text == "Baby Park"), None)
        self.assertIsNotNone(folder_in_list, "Baby Park should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(By.XPATH, "./ancestor::div[@id='folderContainer']")
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Baby Park should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Locate all elements with ID "dropName" and find the one with text "Baby Park"
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements do not contain "Baby Park"
        folder_in_list = next((el for el in drop_name_elements if el.text == "Baby Park"), None)
        self.assertIsNone(folder_in_list, "Baby Park should be visible in the dropdown")
        
        
        
    # ----------------- Test Folder Delete All -----------------
    def test_folder_all_delete(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
        # Click the button with ID "Delete"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Delete")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Click the select all checkbox
        select_all_check = self.wait.until(EC.presence_of_element_located(
            (By.ID, "selectAllCheck")
        ))
    
        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt All should be present')
        
        checkbox.click()
        
        time.sleep(3)
        
        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        
        time.sleep(3)
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertEqual(len(drop_name_elements), 0, "No dropDown elements should be visible")
        
        
    
    # ----------------- Test Folder Share -----------------
    def test_folder_share(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Share")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Check if any of the elements contain Luigi's Mansion
        folder_in_list = next((el for el in drop_name_elements if el.text == "Luigi's Mansion"), None)
        self.assertIsNotNone(folder_in_list, "Luigi's Mansion should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(By.XPATH, "./ancestor::div[@id='folderContainer']")
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Luigis Mansion should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Click the Share Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Share Button should be initialized")
        confirm_delete_button.click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(1)
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        # Check if any of the elements contain "Luigi's Mansion"
        checkbox_name_in_list = next((el for el in checkbox_name_elements if el.text == "Luigi's Mansion"), None)
        self.assertIsNotNone(checkbox_name_in_list, "Luigi's Mansion should be visible in the dropdown")
        
        time.sleep(1)
        
        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(By.XPATH, "./ancestor::div[@id='checkBoxItem']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Luigis Mansion should be present')
        
        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")
        
        time.sleep(1)
    
    
    
    # ----------------- Test Folder Share All -----------------
    def test_folder_all_share(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(1)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Share")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Click the select all checkbox
        select_all_check = self.wait.until(EC.presence_of_element_located(
            (By.ID, "selectAllCheck")
        ))
    
        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt All should be present')
        
        checkbox.click()
        
        time.sleep(1)
        
        # Click the Share All Button
        confirm_share_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_share_button, "Share All Button should be initialized")
        confirm_share_button.click()
        
        time.sleep(1)
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(1)
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        time.sleep(2)
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        # Check if any of the elements contain "Luigi's Mansion"
        checkbox_name_in_list = next((el for el in checkbox_name_elements if el.text == "Luigi's Mansion"), None)
        self.assertIsNotNone(checkbox_name_in_list, "Luigi's Mansion should be visible in the dropdown")
        
        time.sleep(1)
        
        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(By.XPATH, "./ancestor::div[@id='checkBoxItem']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Luigis Mansion should be present')
        
        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        # Check if any of the elements contain "Baby Park"
        checkbox_name_in_list = next((el for el in checkbox_name_elements if el.text == "Baby Park"), None)
        self.assertIsNotNone(checkbox_name_in_list, "Baby Park should be visible in the dropdown")
        
        time.sleep(1)
        
        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(By.XPATH, "./ancestor::div[@id='checkBoxItem']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Baby Park should be present')
        
        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        # Check if any of the elements contain "Admiral Bobbery's Ship"
        checkbox_name_in_list = next((el for el in checkbox_name_elements if el.text == "Admiral Bobbery's Ship"), None)
        self.assertIsNotNone(checkbox_name_in_list, "Admiral Bobbery's Ship should be visible in the dropdown")
        
        time.sleep(1)
        
        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(By.XPATH, "./ancestor::div[@id='checkBoxItem']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Admiral Bobberys Ship should be present')
        
        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")
        
        
        
    # ----------------- Test Folder Clean -----------------
    def test_folder_clean(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Admiral Bobbery's Ship")
        self.create_assistant("King Boo")
        self.create_assistant("Paper Mario")
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Paper Mario"), None)
        self.assertIsNotNone(assistant_in_list, "Paper Mario should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        # This is draggable
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Admiral Bobbery's Ship"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Admiral Bobbery's Ship"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Admiral Bobbery's Ship button should be present")
        
        # This is the droppable button
        drop_folder = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")
        
        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(assistant_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(1)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Clean"
        button = self.wait.until(EC.element_to_be_clickable((By.ID, "Clean")))
        button.click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Luigi's Mansion"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Luigi's Mansion"), None)
        self.assertIsNone(assistant_dropdown_button, "Luigi's Mansion button should be present")
    

    
    # ----------------- Test Folder Open All -----------------
    def test_folder_open_all(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(1)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Open All")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropDown'
        drop_name_elements = right_panel.find_elements(By.ID, "dropDown")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        # Extract and print all title attributes for debugging
        titles = [element.get_attribute("title") for element in drop_name_elements]
        print("Extracted Titles:", titles)  # Debugging output
        
        # Extract and verify that all elements have the title "Collapse Folder"
        expected_title = "Collapse folder"
        all_titles_match = all(element.get_attribute("title") == expected_title for element in drop_name_elements)

        self.assertTrue(all_titles_match, "All dropDown elements should have the title 'Collapse Folder'")
    
    
    # ----------------- Test Folder Close All -----------------
    def test_folder_close_all(self):
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(1)
        
        # Hover over the first subMenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        ActionChains(self.driver).move_to_element(sub_menu).perform()
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Open All")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
       # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Close All")))
        button[-1].click()
        
        time.sleep(1)  # Give time for the menu to appear
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropDown'
        drop_name_elements = right_panel.find_elements(By.ID, "dropDown")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        # Extract and print all title attributes for debugging
        titles = [element.get_attribute("title") for element in drop_name_elements]
        print("Extracted Titles:", titles)  # Debugging output
        
        # Extract and verify that all elements have the title "Expand Folder"
        expected_title = "Expand folder"
        all_titles_match = all(element.get_attribute("title") == expected_title for element in drop_name_elements)

        self.assertTrue(all_titles_match, "All dropDown elements should have the title 'Expand Folder'")
        
        

if __name__ == "__main__":
    unittest.main(verbosity=2)
    
    