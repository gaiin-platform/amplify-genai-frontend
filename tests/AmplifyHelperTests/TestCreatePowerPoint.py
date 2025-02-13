import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

class CreatePowerPointTests(unittest.TestCase):
    
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
            time.sleep(3)  # Wait for 3 seconds before proceeding

            # Wait for a post-login element to ensure login was successful
            self.wait.until(EC.presence_of_element_located(
                (By.XPATH, "/html/body/div/div/main/div[2]/div[2]/div/div/div[1]/div/div[1]")  # "Start a new conversation." text
            ))
        except Exception as e:
            self.fail(f"Login failed: {e}")   
            

        
    # ----------------- Test Create PowerPoint can be clicked -----------------
    
    def test_create_powerpoint_is_interactable(self):                        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create PowerPoint is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create PowerPoint"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create PowerPoint"
        create_powerpoint = next((el for el in prompt_name_elements if el.text == "Create PowerPoint"), None)
        self.assertIsNotNone(create_powerpoint, "Create PowerPoint should be visible in the dropdown")
        
        # Ensure the parent button's
        create_powerpoint_button = create_powerpoint.find_element(By.XPATH, "./ancestor::button")
        button_id = create_powerpoint_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        create_powerpoint_button.click()

        # Ensure the create_powerpoint Chat Label appears after selection
        create_powerpoint_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(create_powerpoint_modal_title, "Create PowerPoint modal title should appear after selection")

        # Extract the text from the element
        modal_text = create_powerpoint_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Create PowerPoint", "Modal title should be 'Create PowerPoint'")
    
    
    
    # ----------------- Test Summary with Shared window -----------------
    # Open dropdown, then hover summary, then click share, then extract and compare text in window for title
    
    def test_share_button(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create PowerPoint is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create PowerPoint"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create PowerPoint"
        create_powerpoint = next((el for el in prompt_name_elements if el.text == "Create PowerPoint"), None)
        self.assertIsNotNone(create_powerpoint, "Create PowerPoint should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_powerpoint_button = create_powerpoint.find_element(By.XPATH, "./ancestor::button")
        button_id = create_powerpoint_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(create_powerpoint_button).perform()
        
        # Locate and click the "Share" button
        share_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "shareTemplate")
        ))
        self.assertIsNotNone(share_button, "Share button should be initialized and clicked")
        share_button.click()
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "shareAnythingModalHeader")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        
    
    
    # ----------------- Test Summary with Shared window check boxes -----------------
    # Open dropdown, then hover summary, then click share, then extract and compare text in check boxes

    def test_create_powerpoint_shared_textbox(self):        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create PowerPoint is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create PowerPoint"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create PowerPoint"
        create_powerpoint = next((el for el in prompt_name_elements if el.text == "Create PowerPoint"), None)
        self.assertIsNotNone(create_powerpoint, "Create PowerPoint should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_powerpoint_button = create_powerpoint.find_element(By.XPATH, "./ancestor::button")
        button_id = create_powerpoint_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(create_powerpoint_button).perform()
        
        # Locate and click the "Share" button
        share_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "shareTemplate")
        ))
        self.assertIsNotNone(share_button, "Share button should be initialized and clicked")
        share_button.click()
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "shareAnythingModalHeader")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        
        # Locate all checkboxes
        checkboxes = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkbox")
        ))
        
        # Find the checked checkbox
        for checkbox in checkboxes:
            if checkbox.is_selected():  # More reliable than get_attribute("checked")
                # Extract the text next to the checked checkbox
                checked_text_element = checkbox.find_element(By.XPATH, "./following-sibling::*")  
                
                extracted_checked_text = checked_text_element.text
                self.assertEqual(extracted_checked_text, "Prompt : Create PowerPoint", "The checked checkbox should have the correct label")
                break
        
        
        
        
    # ----------------- Test Create PowerPoint Duplicate Window -----------------
    # Need to click on the Create PowerPoint button FIRST, so that it passes by the bug
    # GO through Summary Test, then hit the cancel, then hover summary, then click duplicate, then extract and compare text in window
    
    def test_create_powerpoint_duplicate(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create PowerPoint is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create PowerPoint"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create PowerPoint"
        create_powerpoint = next((el for el in prompt_name_elements if el.text == "Create PowerPoint"), None)
        self.assertIsNotNone(create_powerpoint, "Create PowerPoint should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_powerpoint_button = create_powerpoint.find_element(By.XPATH, "./ancestor::button")
        button_id = create_powerpoint_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(create_powerpoint_button).perform()
        
        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "duplicateTemplate")
        ))
        self.assertIsNotNone(duplicate_button, "Duplicate button should be initialized and clicked")
        duplicate_button.click()
        
        # Locate all elements with ID "promptName" and find the one with text "Create PowerPoint (copy)"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Check if any of the elements contain "Create PowerPoint"
        create_powerpoint_copy = next((el for el in prompt_name_elements if el.text == "Create PowerPoint (copy)"), None)
        self.assertIsNotNone(create_powerpoint_copy, "Create PowerPoint (copy) should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_powerpoint_copy_button = create_powerpoint_copy.find_element(By.XPATH, "./ancestor::button")
        button_id = create_powerpoint_copy_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        create_powerpoint_copy_button.click()
        
        summary_modal_text_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        
        extracted_checked_text = summary_modal_text_element.text
        self.assertEqual(extracted_checked_text, "Create PowerPoint (copy)", "The text extracted should be ")
    

if __name__ == "__main__":
    unittest.main(verbosity=2)