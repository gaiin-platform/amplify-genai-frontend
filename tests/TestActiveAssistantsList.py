import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

class ActiveAssistantsListTests(unittest.TestCase):
    
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
        

    # ----------------- Test drop down for Assistant is initialized -----------------
    # This test goes through to test that the Assistant's drop down menu is initialized and visible
    
    def test_dropdown_initially_closed(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract the text from each element
        texts = [element.text for element in drop_name_elements]

        # Check if any of the texts equal "Assistants"
        self.assertIn("Assistants", texts, 'One of the elements should contain the text "Assistants"')



    # # ----------------- Test drop down collapses -----------------
    # # This test goes through to test that the Assistant's drop down menu is clickable 
    # # and that it collapses 
    
    def test_dropdown_opens_on_click(self):
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

        # Ensure the parent button's title is "Collapse folder"
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        self.assertEqual(button_title, "Collapse folder", "Button should change to 'Collapse folder' after clicking")
        
        

    # ----------------- Test drop down collapses and expands -----------------
    # This test goes through to test that the Assistant's drop down menu is clickable 
    # and that it collapses and expands.
    
    def test_dropdown_closes_after_selection(self):
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

        # Ensure the parent button's title is "Collapse folder"
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        self.assertEqual(button_title, "Collapse folder", "Button should change to 'Collapse folder' after clicking")

        # Click to close the dropdown
        assistant_dropdown_button.click()

        # Ensure the button's title is back to "Expand folder"
        button_title = parent_button.get_attribute("title")
        self.assertEqual(button_title, "Expand folder", "Button should change back to 'Expand folder' after clicking again")
        
        

    # ----------------- Test add assistant, save assistant, and that assistant is visible in dropdown -----------------
    # This test goes through to create an assistant and then opens the drop down to ensure that 
    # the assistant is visible in the drop down list
    
    def test_add_assistant_and_in_dropdown(self):
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
        assistant_name_input.send_keys("Assistant Aiba")

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

        # Locate all elements with ID "promptName" and find the one with text "Assistant Aiba"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Assistant Aiba"
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant Aiba"), None)
        self.assertIsNotNone(assistant_in_list, "Assistant Aiba should be visible in the dropdown")
        
        
        
    # ----------------- Test after adding an assistant that it can be clicked on -----------------
    # This test goes through to create an assistant and then ensures that created 
    # assistant can be clicked on and that it's added to the chat window below.
        
    def test_assistant_is_interactable(self):
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
        assistant_name_input.send_keys("Assistant Aiba")

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

        # Locate all elements with ID "promptName" and find the one with text "Assistant Aiba"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant Aiba"), None)
        self.assertIsNotNone(assistant_in_list, "Assistant Aiba should be visible in the dropdown")
        
        # Ensure the parent button's
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        assistant_button.click()

        # Ensure the Assistant Chat Label appears after selection
        assistant_chat_label = self.wait.until(EC.presence_of_element_located(
            (By.ID, "assistantChatLabel")
        ))
        self.assertIsNotNone(assistant_chat_label, "Assistant chat label should appear after selection")

        
    
    # ----------------- Test assistants list updates after adding second assistant -----------------
    # This test goes through to create an assistant and then creates a second assistant
    # afterwards. Once both assistants are created, it checks to make sure both are 
    # present.
    
    def test_check_list_updates_with_multiple_assistants(self):
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
        assistant_name_input.send_keys("Assistant Peko")

        # Locate and click the Save button
        assistant_save_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "saveButton")
        ))
        self.assertIsNotNone(assistant_save_button, "Save button should be initialized and clickable")
        assistant_save_button.click()
        
        time.sleep(5)
        
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
        assistant_name_input.send_keys("Assistant Peko Peko")

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
        
        # Locate all elements with ID "promptName" and find the one with text "Assistant Aiba"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Find the correct assistant in the dropdown list
        first_assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant Peko"), None)
        self.assertIsNotNone(first_assistant_in_list, "Assistant Peko should be visible in the dropdown")
        
        # Find the correct assistant in the dropdown list
        second_assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant Peko Peko"), None)
        self.assertIsNotNone(second_assistant_in_list, "Assistant Peko Peko should be visible in the dropdown")   
    


    # ----------------- Test Edit Button -----------------
    # This test goes through to create an assistant and then upon hovering over an assistant,
    # it clicks the the "Edit Template" button and tests to ensure the Edit window 
    # pops up as intended.
    
    def test_edit_button(self):
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
        assistant_name_input.send_keys("Assistant Rem")

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
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant Rem"), None)
        self.assertIsNotNone(assistant_in_list, "Assistant Rem should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
        # Locate and click the "Edit" button
        edit_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "editTemplate")
        ))
        self.assertIsNotNone(edit_button, "Edit button should be initialized and clicked")
        edit_button.click()
        
        # Verify the presence of the Window element after clicking the Edit button
        edit_window_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "assistantName")
        ))
        self.assertTrue(edit_window_element.is_displayed(), "Edit window element is visible")
        
        
        
        
    # ----------------- Test Share Button -----------------
    # This test goes through to create an assistant and then upon hovering over an assistant,
    # it clicks the the "Share Template" button and tests to ensure the share window 
    # pops up as intended.
    
    def test_share_button(self):
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
        assistant_name_input.send_keys("Assistant Ram")

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
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant Ram"), None)
        self.assertIsNotNone(assistant_in_list, "Assistant Rem should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
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
        
        
        
        
    # ----------------- Test Delete Button -----------------
    # This test goes through to create an assistant and then upon hovering over an assistant,
    # it clicks the the "Delete Template" button and tests the "Confirm" and "Cancel" buttons
    # to ensure the assistants are deleted and remain visible as intended.
    
    def test_delete_button(self):
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
        assistant_name_input.send_keys("Assistant DK")

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
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Assistant DK"), None)
        self.assertIsNotNone(assistant_in_list, "Assistant DK should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
        # Locate and click the "Delete" button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "deleteTemplate")
        ))
        self.assertIsNotNone(delete_button, "Delete button should be initialized and clicked")
        delete_button.click()
        
        # Locate and click the "Delete" button
        cancel_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "cancel")
        ))
        self.assertIsNotNone(cancel_button, "Cancel button should be initialized and clicked")
        cancel_button.click()

        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
        # Locate and click the "Delete" button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "deleteTemplate")
        ))
        self.assertIsNotNone(delete_button, "Delete button should be initialized and clicked")
        delete_button.click()
        
        # Locate and click the "Delete" button
        confirm_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirm")
        ))
        self.assertIsNotNone(cancel_button, "Confirm button should be initialized and clicked")
        confirm_button.click()

        
        
    # # ----------- Pin Folder to the Top -----------
    # Future Test



if __name__ == "__main__":
    unittest.main(verbosity=2)
    