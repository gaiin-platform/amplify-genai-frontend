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

    def tearDown(self):
        self.driver.quit()
        
    # ----------------- Login -----------------
    def login(self, username, password):
        """Helper method to perform login."""
        try:
            # Click the login button to reveal the login form
            login_button = self.wait.until(EC.element_to_be_clickable(
                (By.XPATH, "//*[@id='__next']/div/main/div/button")
            ))
            login_button.click()

            # Wait for the username and password fields to appear
            username_field = self.wait.until(EC.presence_of_element_located(
                (By.XPATH, "/html/body/div[1]/div/div[2]/div[2]/div[2]/div[2]/div/div/form/div[1]/input")
            ))
            password_field = self.wait.until(EC.presence_of_element_located(
                (By.XPATH, "/html/body/div[1]/div/div[2]/div[2]/div[2]/div[2]/div/div/form/div[2]/input")
            ))

            # Enter username and password
            username_field.send_keys(username)
            password_field.send_keys(password)

            # Submit the login form
            submit_button = self.wait.until(EC.element_to_be_clickable(
                (By.XPATH, "/html/body/div[1]/div/div[2]/div[2]/div[2]/div[2]/div/div/form/input[3]")
            ))
            submit_button.click()
            
            # Add a short delay to wait for the loading screen
            time.sleep(8)  # Wait for 8 seconds before proceeding

            # Wait for a post-login element to ensure login was successful
            self.wait.until(EC.presence_of_element_located(
                (By.XPATH, "/html/body/div/div/main/div[2]/div[2]/div/div/div[1]/div/div[1]")  # "Start a new conversation." text
            ))
        except Exception as e:
            self.fail(f"Login failed: {e}")   
            


    # Folder expands and can hold Assistants, Helpers, and Instructions Created
    
    # ----------------- Test add Folder and that it appears -----------------
    # This test goes through to create a new folder and then check for the specific one
    # in the list of Prompts.

    def test_add_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[-1].click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Thousand Sunny")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
            
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)

        # Find the element with text "Thousand Sunny"
        folder = next((el for el in drop_name_elements if el.text == "Thousand Sunny"), None)
        self.assertIsNotNone(folder, "Thousand Sunny button should be present")



    # ----------------- Test Pin Folder to the top -----------------
    # This test goes through to create a new folder and then check for the specific one
    # in the list of Prompts.
    
    def test_pin_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[-1].click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Going Merry")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
            
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)

        # Find the element with text "Going Merry"
        folder = next((el for el in drop_name_elements if el.text == "Going Merry"), None)
        self.assertIsNotNone(folder, "Going Merry button should be present")
         
        # Hover over the "Going Merry" button to make the "Pin" button visible        
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()
        
        # Locate and click the "Pin" button
        pin_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "pinButton")
        ))
        self.assertIsNotNone(pin_button, "Pin button should be initialized and clicked")
        pin_button.click()
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract the first element
        first_element = drop_name_elements[0]

        # Get its text and compare it to "Going Merry"
        self.assertEqual(first_element.text.strip(), "Going Merry", "First drop name element should be 'Going Merry'")
        
            
    
    # ----------------- Test Rename Folder -----------------
    # This test goes through to create a new folder and then check for the specific one
    # in the list of Prompts.
    
    def test_rename_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[-1].click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("GOING MERRY")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
            
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)

        # Find the element with text "GOING MERRY"
        folder = next((el for el in drop_name_elements if el.text == "GOING MERRY"), None)
        self.assertIsNotNone(folder, "GOING MERRY button should be present")
         
        # Hover over the "Temp Folder" button to make the "Rename" button visible        
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()
        
        # Locate and click the "rename" button
        rename_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "renameButton")
        ))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()
        
        rename_field = self.wait.until(EC.presence_of_element_located(
            (By.ID, "renameInput")
        ))

        # Add a " 2" onto the end of the "Temp Folder" name
        rename_field.send_keys(" V2")
        
        rename_cancel_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "cancel")
        ))
        self.assertIsNotNone(rename_cancel_button, "Rename cancel button should be initialized and clicked")
        
        rename_cancel_button.click()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "GOING MERRY"
        folder = next((el for el in drop_name_elements if el.text == "GOING MERRY"), None)
        self.assertIsNotNone(folder, "GOING MERRY button should be present")
         
        # Hover over the "Temp Folder" button to make the "Rename" button visible        
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()
        
        # Locate and click the "rename" button
        rename_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "renameButton")
        ))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()
        
        rename_field = self.wait.until(EC.presence_of_element_located(
            (By.ID, "renameInput")
        ))

        # Add a " 2" onto the end of the "Temp Folder" name
        rename_field.send_keys(" V2")
        
        rename_confirm_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirm")
        ))
        self.assertIsNotNone(rename_confirm_button, "Rename confirm button should be initialized and clicked")
        
        rename_confirm_button.click()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "GOING MERRY"
        folder = next((el for el in drop_name_elements if el.text == "GOING MERRY V2"), None)
        self.assertIsNotNone(folder, "GOING MERRY button should be present")
        

            
    # ----------------- Test Delete Folder -----------------
    # This test goes through to create a new folder and then check for the specific one
    # in the list of Prompts.

    
    def test_delete_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[-1].click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("River Raiders")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "River Raiders"
        folder = next((el for el in drop_name_elements if el.text == "River Raiders"), None)
        self.assertIsNotNone(folder, "River Raiders button should be present")
         
        # Hover over the "River Raiders" button to make the "Rename" button visible        
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()
        
        # Locate and click the "delete" button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "deleteButton")
        ))
        self.assertIsNotNone(delete_button, "Delete button should be initialized and clicked")
        delete_button.click()
        
        delete_confirm_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirm")
        ))
        self.assertIsNotNone(delete_confirm_button, "Delete confirm button should be initialized and clicked")
        
        delete_confirm_button.click()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "River Raiders"
        folder = next((el for el in drop_name_elements if el.text == "River Raiders"), None)
        self.assertIsNone(folder, "River Raiders button should NOT be present")
        
        

    # ----------------- Test Add Item to Folder -----------------
    # This test goes through to create a new folder and then check for the specific one
    # in the list of Prompts.

    
    def test_add_item_to_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[-1].click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Mario Party")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # Locate and click the Add Assistant button
        assistant_add_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "addAssistantButton")
        ))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()

        # Locate the Assistant Name input field, clear it, and type "Assistant Aiba"
        assistant_name_input = self.wait.until(EC.presence_of_element_located(
            (By.ID, "assistantName")
        ))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Luigi")

        # Locate and click the Save button
        assistant_save_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "saveButton")
        ))
        self.assertIsNotNone(assistant_save_button, "Save button should be initialized and clickable")
        assistant_save_button.click()
        
        time.sleep(5)
            
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Assistants"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")

        # Click to open the dropdown
        assistant_dropdown_button.click()
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Luigi"), None)
        self.assertIsNotNone(assistant_in_list, "Luigi should be visible in the dropdown")
        
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
    