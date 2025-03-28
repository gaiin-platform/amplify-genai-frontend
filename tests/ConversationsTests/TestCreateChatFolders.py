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

def load_env():
    # List of possible locations for .env.local
    possible_locations = [
        os.getenv('ENV_FILE'),  # From bash script
        os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'),  # Two levels up
        os.path.join(os.path.dirname(__file__), '..', '.env.local'),  # One level up
        os.path.join(os.path.dirname(__file__), '.env.local'),  # Same directory
    ]

    for location in possible_locations:
        if location and os.path.isfile(location):
            load_dotenv(location)
            # print(f"Loaded environment from: {location}")
            return True
    
    print("Warning: .env.local file not found")
    return False

class CreateChatFolderTests(unittest.TestCase):
    
    # ----------------- Setup -----------------
    def setUp(self, headless=False):
        
        # Load environment variables from .env.local
        load_env()

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
        self.driver.quit()  # Always quit the browser
        
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
            
            
    # ----------------- Setup function ----------------- 
    def create_chat(self):
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        chat_add_button = next((el for el in prompt_buttons if el.text == "New Chat"), None)
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        chat_add_button.click()
        
        time.sleep(2)
        
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        chats = next((el for el in chat_name_elements if el.text == "New Conversation"), None)
        self.assertIsNotNone(chats, "New Conversation button should be present")

        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()

        rename_button = self.wait.until(EC.element_to_be_clickable((By.ID, "isRenaming")))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()
        rename_field = self.wait.until(EC.presence_of_element_located((By.ID, "isRenamingInput")))

        time.sleep(2)
        
        rename_field.clear()
        rename_field.send_keys("Movable Converstation")
        rename_confirm_button = self.wait.until(EC.element_to_be_clickable((By.ID, "handleConfirm")))
        self.assertIsNotNone(rename_confirm_button, "Rename confirm button should be initialized and clicked")
        rename_confirm_button.click()
        
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        folder = next((el for el in drop_name_elements if el.text == "Movable Converstation"), None)
        self.assertIsNotNone(folder, "New Conversation button should be present")
    


    # ----------------- Test Create Folder -----------------
    """This test will create a folder and ensure it is present in the list"""
    
    def test_add_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the first button (assuming it's on the right)
        folder_add_buttons[0].click()
        
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
            
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)

        # Find the element with text "Mario Party"
        folder = next((el for el in drop_name_elements if el.text == "Mario Party"), None)
        self.assertIsNotNone(folder, "Mario Party button should be present")

    
    
    # ----------------- Test Pin Folder -----------------
    """This test ensures that the created folder is pinned to the top of the list
       of folders when the pin button on the specified folder is pressed"""
       
    def test_pin_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[0].click()
        
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

        # Use the left sidebar
        left_panel = side_bar_detection[0]
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract the first element
        first_element = drop_name_elements[0]

        # Get its text and compare it to "Going Merry"
        self.assertEqual(first_element.text.strip(), "Going Merry", "First drop name element should be 'Going Merry'")
        
        
    
    # ----------------- Test Rename Folder -----------------
    """This test ensures that the created folder is renamed 
       when the rename button on the specified folder is pressed"""
       
    def test_rename_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[0].click()
        
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
    """This test ensures that the created folder is deleted 
       when the delete button on the specified folder is pressed"""
       
    def test_delete_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[0].click()
        
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
    """This test ensures that the created folder can get a conversation
       variable added into the folder via drag and drop"""
       
    def test_rename_folder(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_buttons[0].click()
        
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
        
        self.create_chat()
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Movable Converstation"), None)
        self.assertIsNotNone(assistant_in_list, "Movable Converstation should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        # This is draggable
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Mario Party"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "GOING MERRY"), None)
        self.assertIsNotNone(assistant_dropdown_button, "GOING MERRY button should be present")
        
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
    
    