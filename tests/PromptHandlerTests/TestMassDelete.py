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
    def setUp(self, headless=True):
        
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
        
        # Create Setup Test Variables 
        self.setup_test_data(num_assistants=2, num_prompts=2)

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
    
    def setup_test_data(self, num_assistants=2, num_prompts=2):
        """Creates a folder, a specified number of assistants, and prompts."""
        self.create_folder("Mario Party")
        
        for i in range(1, num_assistants + 1):
            self.create_assistant(f"Shy Guy {i}")
        
        for i in range(1, num_prompts + 1):
            self.create_prompt(f"Toad {i}")

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
        
        time.sleep(2)
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        time.sleep(2)
        folder = next((el for el in drop_name_elements if el.text == folder_name), None)
        self.assertIsNotNone(folder, f"{folder_name} button should be present")

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

    def create_prompt(self, prompt_name):
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
        prompt_add_button = next((el for el in prompt_buttons if el.text == "Prompt Template"), None)
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
        prompt_add_button.click()
        
        time.sleep(2)
        prompt_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "promptModalName")))
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys(prompt_name)
        
        time.sleep(2)
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        save_button.click()
        
        time.sleep(2)
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        prompt_in_list = next((el for el in prompt_name_elements if el.text == prompt_name), None)
        self.assertIsNotNone(prompt_in_list, f"{prompt_name} should be visible in the dropdown")



    # ----------------- Test Delete Mass Assistants -----------------
    
    def test_delete_mass_assistants(self):
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Shy Guy 1"), None)
        self.assertIsNotNone(assistant_in_list, "Shy Guy 1 should be visible in the dropdown")
        
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

        # Find the element with text "Mario Party"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Mario Party"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Mario Party button should be present")
        
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
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Click the Delete Button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Delete")
        ))
        self.assertTrue(delete_button, "Delete Button should be initialized")
        delete_button.click()
        
        time.sleep(3)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to close the dropdown
        amplify_helper_dropdown_button.click()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        custom_instructions_dropdown_button = next((el for el in drop_name_elements if el.text == "Custom Instructions"), None)
        self.assertIsNotNone(custom_instructions_dropdown_button, "Custom Instructions button should be present")

        # Click to open the dropdown
        custom_instructions_dropdown_button.click()
        
        # Find Prompt name and try to find the checkbox?
        time.sleep(2)
        # Locate all elements with ID "promptName" and find the one with text "Shy Guy 1"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Shy Guy 1"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Shy Guy 1"), None)
        self.assertIsNotNone(prompt_in_list, "Shy Guy 1 should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(By.XPATH, "./ancestor::div[@id='promptEncompass']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Shy Guy 1 should be present')

        # Click the checkbox
        checkbox.click()
        
        # Locate all elements with ID "promptName" and find the one with text "Shy Guy 1"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Shy Guy 2"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Shy Guy 2"), None)
        self.assertIsNotNone(prompt_in_list, "Shy Guy 2 should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(By.XPATH, "./ancestor::div[@id='promptEncompass']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Shy Guy 2 should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(3)
        
        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        
        # Locate all elements with ID "promptName" and find the one with text "Shy Guy 1"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements do not contain "Shy Guy 1"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Shy Guy 1"), None)
        self.assertIsNone(prompt_in_list, "Shy Guy 1 should be visible in the dropdown")
        
        # Check if any of the elements do not contain "Shy Guy 1"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Shy Guy 2"), None)
        self.assertIsNone(prompt_in_list, "Shy Guy 1 should be visible in the dropdown")
    
    
    # ----------------- Test Delete Mass Prompts -----------------

    def test_delete_mass_prompts(self):
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Click the Delete Button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Delete")
        ))
        self.assertTrue(delete_button, "Delete Button should be initialized")
        delete_button.click()
        
        time.sleep(3)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to close the dropdown
        amplify_helper_dropdown_button.click()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        custom_instructions_dropdown_button = next((el for el in drop_name_elements if el.text == "Custom Instructions"), None)
        self.assertIsNotNone(custom_instructions_dropdown_button, "Custom Instructions button should be present")

        # Click to open the dropdown
        custom_instructions_dropdown_button.click()
        
        # Find Prompt name and try to find the checkbox?
        time.sleep(2)
        # Locate all elements with ID "promptName" and find the one with text "Toad 1"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Toad 1"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Toad 1"), None)
        self.assertIsNotNone(prompt_in_list, "Toad 1 should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(By.XPATH, "./ancestor::div[@id='promptEncompass']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Toad 1 should be present')

        # Click the checkbox
        checkbox.click()
        
        # Locate all elements with ID "promptName" and find the one with text "Toad 2"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Toad 2"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Toad 2"), None)
        self.assertIsNotNone(prompt_in_list, "Toad 2 should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(By.XPATH, "./ancestor::div[@id='promptEncompass']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Toad 2 should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(3)
        
        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        
        # Locate all elements with ID "promptName" and find the one with text "Shy Guy 1"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements do not contain "Toad 1"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Toad 1"), None)
        self.assertIsNone(prompt_in_list, "Toad 1 should be visible in the dropdown")
        
        # Check if any of the elements do not contain "Toad 1"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Toad 2"), None)
        self.assertIsNone(prompt_in_list, "Toad 2 should be visible in the dropdown")
        
    
    
    # ----------------- Test Delete Everything -----------------
    
    def test_delete_everything(self):
        
        # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[-1].click()
        
        time.sleep(3)
        
        # Click the Delete Button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Delete")
        ))
        self.assertTrue(delete_button, "Delete Button should be initialized")
        delete_button.click()
        
        time.sleep(3)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to close the dropdown
        amplify_helper_dropdown_button.click()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        custom_instructions_dropdown_button = next((el for el in drop_name_elements if el.text == "Custom Instructions"), None)
        self.assertIsNotNone(custom_instructions_dropdown_button, "Custom Instructions button should be present")

        # Click to open the dropdown
        custom_instructions_dropdown_button.click()
        
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
        
        # Ensure no promptName elements are present
        self.assertTrue(
            self.wait.until(EC.invisibility_of_element_located((By.ID, "promptName"))),
            "Prompt name elements should NOT be present"
        )

    
    
if __name__ == "__main__":
    unittest.main(verbosity=2)
    