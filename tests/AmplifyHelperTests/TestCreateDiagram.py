import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

class CreateDiagramTests(unittest.TestCase):

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
        


    # ----------------- Test Create Diagram can be clicked -----------------
    #
    
    def test_create_diagram_is_interactable(self):                        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next((el for el in prompt_name_elements if el.text == "Create Diagram"), None)
        self.assertIsNotNone(create_diagram, "Create Diagram should be visible in the dropdown")
        
        # Ensure the parent button's
        create_diagram_button = create_diagram.find_element(By.XPATH, "./ancestor::button")
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        create_diagram_button.click()

        # Ensure the create_diagram Chat Label appears after selection
        create_diagram_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(create_diagram_modal_title, "Create Diagram modal title should appear after selection")

        # Extract the text from the element
        modal_text = create_diagram_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Create Diagram", "Modal title should be 'Create Diagram'")
    
    
    
    # ----------------- Test Summary with Shared window -----------------
    # Open dropdown, then hover summary, then click share, then extract and compare text in window for title
    
    def test_share_button(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next((el for el in prompt_name_elements if el.text == "Create Diagram"), None)
        self.assertIsNotNone(create_diagram, "Create Diagram should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_diagram_button = create_diagram.find_element(By.XPATH, "./ancestor::button")
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(create_diagram_button).perform()
        
        # Locate and click the "Share" button
        share_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "shareTemplate")
        ))
        self.assertIsNotNone(share_button, "Share button should be initialized and clicked")
        share_button.click()
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        
        
        
    # ----------------- Test Create Diagram Duplicate Window -----------------
    # Need to click on the Create Diagram button FIRST, so that it passes by the bug
    # GO through Summary Test, then hit the cancel, then hover summary, then click duplicate, then extract and compare text in window
    
    def test_create_diagram_duplicate(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next((el for el in prompt_name_elements if el.text == "Create Diagram"), None)
        self.assertIsNotNone(create_diagram, "Create Diagram should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_diagram_button = create_diagram.find_element(By.XPATH, "./ancestor::button")
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(create_diagram_button).perform()
        
        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "duplicateTemplate")
        ))
        self.assertIsNotNone(duplicate_button, "Duplicate button should be initialized and clicked")
        duplicate_button.click()
        
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram (copy)"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Check if any of the elements contain "Create Diagram"
        create_diagram_copy = next((el for el in prompt_name_elements if el.text == "Create Diagram (copy)"), None)
        self.assertIsNotNone(create_diagram_copy, "Create Diagram (copy) should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        create_diagram_copy_button = create_diagram_copy.find_element(By.XPATH, "./ancestor::button")
        button_id = create_diagram_copy_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        create_diagram_copy_button.click()
        
        summary_modal_text_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        
        extracted_checked_text = summary_modal_text_element.text
        self.assertEqual(extracted_checked_text, "Create Diagram (copy)", "The text extracted should be ")
        
        
    
    # Inspect Element Notes
    # Console Freeze: setTimeout( ()=>{ debugger }, 3000)
if __name__ == "__main__":
    unittest.main(verbosity=2)