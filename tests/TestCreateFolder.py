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
            


    # id="createFolderButton"

    # Folder expands and can hold Assistants, Helpers, and Instructions Created
    
    # ----------------- Test add Folder and that it appears -----------------
    # This test goes through to create a new folder and then check for the specific one
    # in the list of Prompts.
    
    # Test Status: Passed

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



    # # ----------------- Test Pin Folder to the top -----------------
    # # This test goes through to create a new folder and then check for the specific one
    # # in the list of Prompts.
    
    # # Test Status: Passed
    
    # # id="pinButton"
    # # id="renameButton"
    # # id="deleteButton"
    
    # def test_pin_folder(self):
    #     # Extra sleep for extra loading 
    #     time.sleep(5)
        
    #     folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
    #     self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")

    #     # Click the last button (assuming it's on the right)
    #     folder_add_buttons[-1].click()
        
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Clear existing text and send new text
    #         alert.send_keys("Going Merry")
            
    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
        
    #     time.sleep(2)
            
    #     # Locate all elements with the ID 'dropName'
    #     drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
    #         (By.ID, "dropName")
    #     ))
    #     self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
    #     time.sleep(2)

    #     # Find the element with text "Going Merry"
    #     folder = next((el for el in drop_name_elements if el.text == "Going Merry"), None)
    #     self.assertIsNotNone(folder, "Going Merry button should be present")
         
    #     # Hover over the "Going Merry" button to make the "Pin" button visible        
    #     action = ActionChains(self.driver)
    #     action.move_to_element(folder).perform()
        
    #     # Locate and click the "Pin" button
    #     pin_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.ID, "pinButton")
    #     ))
    #     self.assertIsNotNone(pin_button, "Pin button should be initialized and clicked")
    #     pin_button.click()
        
    #     # Locate all elements with the ID 'dropName'
    #     drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
    #         (By.ID, "dropName")
    #     ))
    #     self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

    #     # Extract the first element
    #     first_element = drop_name_elements[0]

    #     # Get its text and compare it to "Going Merry"
    #     self.assertEqual(first_element.text.strip(), "Going Merry", "First drop name element should be 'Going Merry'")
        
        
    
    # # ----------------- Test Rename Folder -----------------
    # # This test goes through to create a new folder and then check for the specific one
    # # in the list of Prompts.
    
    # # Test Status: Passed
    
    # def test_rename_folder(self):
    #     # Extra sleep for extra loading 
    #     time.sleep(5)
        
    #     # Locate the Folder button 
    #     folder_add_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, "/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[1]/button[2]")
    #     ))
    #     self.assertIsNotNone(folder_add_button, "Button should be initialized and clicked")
        
    #     # Click open Add Folder menu
    #     folder_add_button.click()
        
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Send text to the prompt
    #         alert.send_keys("Temp Folder")
            
    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
            
    #     # Iterate through folder list to find the correct folder
    #     index = 1
    #     found = False
    #     folder_name = "Temp Folder"
        
    #     while True:
    #         # Dynamically build the XPath with the current index
    #         folder_xpath = f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div"
                
    #         # Wait for the folder to be present
    #         folder_element = self.wait.until(EC.presence_of_element_located((By.XPATH, folder_xpath)))
                
    #         # Extract the folder name
    #         extracted_folder_name = folder_element.text
    #         print(f"Checking Folder at index {index}: {extracted_folder_name}")  # Debugging

    #         # Check if the folder name matches
    #         if extracted_folder_name.strip() == "Temp Folder":
    #             found = True
    #             break  # Exit loop once the folder is found
            
    #         index += 1  # Move to the next folder
        
    #     # Final assertion to ensure the folder was found
    #     self.assertTrue(found, f"Folder named '{folder_name}' was not found in the list.")

    #     # Folder is visible in drop down menu
    #     folder = self.wait.until(EC.presence_of_element_located(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div")
    #     ))
    #     self.assertTrue(folder.is_displayed(), "Folder is visible")
         
    #     # Hover over the "Temp Folder" button to make the "Rename" button visible        
    #     action = ActionChains(self.driver)
    #     action.move_to_element(folder).perform()
        
    #     # /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[1]/div/button[1]
    #     # Locate and click the "rename" button
    #     rename_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div/button[2]")
    #     ))
    #     self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
    #     rename_button.click()
    
    #     # /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[1]/div[1]/input
    #     # /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[1]/div[1]/input
        
    #     rename_test_cancel = False
        
    #     rename_field = self.wait.until(EC.presence_of_element_located(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div[1]/input")
    #     ))

    #     # Add a " 2" onto the end of the "Temp Folder" name
    #     rename_field.send_keys(" 2")
        
    #     rename_cancel_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div/button[2]")
    #     ))
    #     self.assertIsNotNone(rename_cancel_button, "Rename cancel button should be initialized and clicked")
        
    #     rename_cancel_button.click()
        
    #     # Dynamically build the XPath with the current index
    #     rename_xpath = f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div"
            
    #     # Wait for the folder to be present
    #     rename_element = self.wait.until(EC.presence_of_element_located((By.XPATH, rename_xpath)))
        
    #     # Extract the folder name
    #     extracted_rename = rename_element.text
        
    #     if extracted_rename.strip() == "Temp Folder":
    #         rename_test_cancel = True
            
    #     # Final assertion to ensure the folder was found
    #     self.assertTrue(rename_test_cancel, f"Folder named '{extracted_rename}' was not found in the list.")
        
    #     # Folder is visible in drop down menu
    #     folder = self.wait.until(EC.presence_of_element_located(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div")
    #     ))
    #     self.assertTrue(folder.is_displayed(), "Folder is visible")
         
    #     # Hover over the "Temp Folder" button to make the "Rename" button visible        
    #     action = ActionChains(self.driver)
    #     action.move_to_element(folder).perform()
        
    #     # /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[1]/div/button[1]
    #     # Locate and click the "rename" button
    #     rename_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div/button[2]")
    #     ))
    #     self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
    #     rename_button.click()
    
    #     # /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[1]/div[1]/input
        
    #     rename_test_confirm = False
        
    #     rename_field = self.wait.until(EC.presence_of_element_located(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div[1]/input")
    #     ))

    #     # Add a " 2" onto the end of the "Temp Folder" name
    #     rename_field.send_keys(" 2")
        
    #     rename_confirm_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div/button[1]")
    #     ))
    #     self.assertIsNotNone(rename_confirm_button, "Rename cancel button should be initialized and clicked")
        
    #     rename_confirm_button.click()
        
    #     # Dynamically build the XPath with the current index
    #     rename_xpath = f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div"
            
    #     # Wait for the folder to be present
    #     rename_element = self.wait.until(EC.presence_of_element_located((By.XPATH, rename_xpath)))
        
    #     # Extract the folder name
    #     extracted_rename = rename_element.text
        
    #     if extracted_rename.strip() == "Temp Folder 2":
    #         rename_test_confirm = True
            
    #     # Final assertion to ensure the folder was found
    #     self.assertTrue(rename_test_confirm, f"Folder named '{extracted_rename}' was not found in the list.")
            
    
    # # ----------------- Test Delete Folder -----------------
    # # This test goes through to create a new folder and then check for the specific one
    # # in the list of Prompts.
    
    # # Test Status: 
    
    # def test_delete_folder(self):
    #     # Extra sleep for extra loading 
    #     time.sleep(5)
        
    #     # Locate the Folder button 
    #     folder_add_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, "/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[1]/button[2]")
    #     ))
    #     self.assertIsNotNone(folder_add_button, "Button should be initialized and clicked")
        
    #     # Click open Add Folder menu
    #     folder_add_button.click()
        
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Send text to the prompt
    #         alert.send_keys("Temp Folder")
            
    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
            
    #     # Iterate through folder list to find the correct folder
    #     index = 1
    #     found = False
    #     folder_name = "Temp Folder"
        
    #     while True:
    #         # Dynamically build the XPath with the current index
    #         folder_xpath = f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div"
                
    #         # Wait for the folder to be present
    #         folder_element = self.wait.until(EC.presence_of_element_located((By.XPATH, folder_xpath)))
                
    #         # Extract the folder name
    #         extracted_folder_name = folder_element.text
    #         print(f"Checking Folder at index {index}: {extracted_folder_name}")  # Debugging

    #         # Check if the folder name matches
    #         if extracted_folder_name.strip() == "Temp Folder":
    #             found = True
    #             break  # Exit loop once the folder is found
            
    #         index += 1  # Move to the next folder
        
    #     # Final assertion to ensure the folder was found
    #     self.assertTrue(found, f"Folder named '{folder_name}' was not found in the list.")

    #     # Folder is visible in drop down menu
    #     folder = self.wait.until(EC.presence_of_element_located(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div")
    #     ))
    #     self.assertTrue(folder.is_displayed(), "Folder is visible")
         
    #     # Hover over the "Temp Folder" button to make the "Delete" button visible        
    #     action = ActionChains(self.driver)
    #     action.move_to_element(folder).perform()
        
    #     # Locate and click the "rename" button
    #     delete_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div/button[3]")
    #     ))
    #     self.assertIsNotNone(delete_button, "Delete button should be initialized and clicked")
    #     delete_button.click()
    
    #     delete_confirm_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/div/button[1]")
    #     ))
    #     self.assertIsNotNone(delete_confirm_button, "Delete confirm button should be initialized and clicked")
        
    #     delete_confirm_button.click()
        
    #     # Iterate through folder list to ensure 'Temp Folder' is not present
    #     index = 1
    #     found = False
    #     folder_name = "Temp Folder"
        
    #     while True:
    #         try:
    #             # Dynamically build the XPath with the current index
    #             folder_xpath = f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div"

    #             # Wait for the folder to be present
    #             folder_element = self.wait.until(EC.presence_of_element_located((By.XPATH, folder_xpath)))

    #             # Extract the folder name
    #             extracted_folder_name = folder_element.text
    #             print(f"Checking Folder at index {index}: {extracted_folder_name}")  # Debugging

    #             # Check if the folder name matches
    #             if extracted_folder_name.strip() == "Temp Folder":
    #                 found = True
    #                 break  # Exit loop if the folder is found

    #             index += 1  # Move to the next folder

    #         except TimeoutException:
    #             # Break the loop if no more folders are found
    #             break

    #     # Final assertion to ensure the folder was not found
    #     self.assertFalse(found, f"Folder named '{folder_name}' was found in the list, but it should not be.")
        
        
    
    
    # # ----------------- Test Add Item to Folder -----------------
    # # This test goes through to create a new folder and then check for the specific one
    # # in the list of Prompts.
    
    # # Search to find Assistant list, Open Assistant, Search to find folder, take Assitant index + 1, 
    # # drag and drop to folder index.
    
    
    # # Test Status: 
    
    # def test_add_item_to_folder(self):
    #     # Extra sleep for extra loading 
    #     time.sleep(5)
        
    #     # Locate the Folder button 
    #     folder_add_button = self.wait.until(EC.element_to_be_clickable(
    #         (By.XPATH, "/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[1]/button[2]")
    #     ))
    #     self.assertIsNotNone(folder_add_button, "Button should be initialized and clicked")
        
    #     # Click open Add Folder menu
    #     folder_add_button.click()
        
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Send text to the prompt
    #         alert.send_keys("Temp Folder")
            
    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
            
    #     # Iterate through folder list to find the correct folder
    #     index = 1
    #     found = False
    #     folder_name = "Temp Folder"
        
    #     while True:
    #         # Dynamically build the XPath with the current index
    #         folder_xpath = f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div"
                
    #         # Wait for the folder to be present
    #         folder_element = self.wait.until(EC.presence_of_element_located((By.XPATH, folder_xpath)))
                
    #         # Extract the folder name
    #         extracted_folder_name = folder_element.text
    #         print(f"Checking Folder at index {index}: {extracted_folder_name}")  # Debugging

    #         # Check if the folder name matches
    #         if extracted_folder_name.strip() == "Temp Folder":
    #             found = True
    #             break  # Exit loop once the folder is found
            
    #         index += 1  # Move to the next folder
        
    #     # Final assertion to ensure the folder was found
    #     self.assertTrue(found, f"Folder named '{folder_name}' was not found in the list.")

    #     # Folder is visible in drop down menu
    #     folder = self.wait.until(EC.presence_of_element_located(
    #         (By.XPATH, f"/html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[{index}]/button/div")
    #     ))
    #     self.assertTrue(folder.is_displayed(), "Folder is visible")
        
    #     # Draggable: /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[4]/div/div/button
    #     # Droppable: /html/body/div/div/main/div[2]/div[3]/div[1]/div/div/div[4]/div[1]/div/div[1]/button



if __name__ == "__main__":
    unittest.main(verbosity=2)
    
    
    # Inspect Element Notes

    # Console Freeze: setTimeout( ()=>{ debugger }, 3000)