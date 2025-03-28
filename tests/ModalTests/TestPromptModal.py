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
from selenium.webdriver.support.ui import Select

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

class PromptModelTests(unittest.TestCase):
    
    # ----------------- Setup -----------------
    def setUp(self, headless=True):
        
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
        
        # Create Setup Test Variables 
        # self.setup_test_data(num_assistants=2, num_prompts=2)

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
            


    # ----------------- Test Prompt Fields -----------------
    """This test goes through to create a prompt and testing all the fields"""
    
    def test_prompt_fields(self):
        
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
        prompt_add_button = next((el for el in prompt_buttons if el.text == "Prompt Template"), None)
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
        prompt_add_button.click()
        
        time.sleep(2)
        
        prompt_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "promptModalName")))
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Red")
        
        time.sleep(2)
        
        # id="promptDescription" This is a textarea element, fill in at this id, "This prompt has a description" 
        prompt_description = self.wait.until(EC.presence_of_element_located((By.ID, "promptDescription")))
        self.assertIsNotNone(prompt_description, "Prompt description textarea should be present")
        prompt_description.clear()
        prompt_description.send_keys("This is a prompt about Red")

        time.sleep(3)
        
        # id="customInstructions" This is a select element, Get the list of options, and then go through all of the select items.
        custom_instructions = self.wait.until(EC.presence_of_element_located((By.ID, "customInstructions")))
        self.assertIsNotNone(custom_instructions, "Custom Instructions select should be present")
        instruction_options = [option.text for option in custom_instructions.find_elements(By.TAG_NAME, "option")]
        self.assertTrue(instruction_options, "Custom Instructions select should contain options")
        
        # id="promptContent" This is a textarea element, fill in at this id, "This has the prompt content" 
        prompt_content = self.wait.until(EC.presence_of_element_located((By.ID, "promptContent")))
        self.assertIsNotNone(prompt_content, "Prompt content textarea should be present")
        prompt_content.clear()
        prompt_content.send_keys("Red is a strong Pokemon Champion")
        
        time.sleep(3)
        
        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)
        
        # id="promptOptimizerButton" This is a button, click this button and then wait time.sleep(15)
        optimizer_button = self.wait.until(EC.presence_of_element_located((By.ID, "promptOptimizerButton")))
        self.assertIsNotNone(optimizer_button, "Prompt Optimizer button should be present")
        optimizer_button.click()
        
        time.sleep(15)
        
        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)
        
        conversation_tags_button = self.wait.until(EC.presence_of_element_located((By.ID, "conversationTags")))
        self.assertIsNotNone(conversation_tags_button, "Conversation Tags button should be present")
        expand_button = conversation_tags_button.find_element(By.XPATH, './/button[@title="Expand"]')
        expand_button.click()
        
        time.sleep(3)
        
        # id="tagNamesInput" This is a textarea element, fill in at this id, "Pokemon Champion, Pokemon Trainer" 
        tag_names_input = self.wait.until(EC.presence_of_element_located((By.ID, "tagNamesInput")))
        self.assertIsNotNone(tag_names_input, "Tag Names input should be present")
        tag_names_input.clear()
        tag_names_input.send_keys("Pokemon Champion, Pokemon Trainer")
        
        time.sleep(3)
        
        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)
        
        # id="promptTemplateCheck" This is a checkbox, click it
        prompt_template_check = self.wait.until(EC.presence_of_element_located((By.ID, "promptTemplateCheck")))
        self.assertIsNotNone(prompt_template_check, "Prompt Template checkbox should be present")
        prompt_template_check.click()

        time.sleep(3)
        
        # id="customInstructionsCheck" This is a checkbox, click it
        custom_instructions_check = self.wait.until(EC.presence_of_element_located((By.ID, "customInstructionsCheck")))
        self.assertIsNotNone(custom_instructions_check, "Custom Instructions checkbox should be present")
        custom_instructions_check.click()

        time.sleep(3)
        
        # id="followUpButtonCheck" This is a checkbox, click it
        follow_up_button_check = self.wait.until(EC.presence_of_element_located((By.ID, "followUpButtonCheck")))
        self.assertIsNotNone(follow_up_button_check, "Follow Up Button checkbox should be present")
        follow_up_button_check.click()

        time.sleep(3)

        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "confirmationButton")
        ))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        
        save_button.click()

        time.sleep(2)

        # Locate all elements with ID "promptName" and find the one with text "Prompt Red"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Prompt Red"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Prompt Red"), None)
        self.assertIsNotNone(prompt_in_list, "Prompt Red should be visible in the dropdown")
        
        
        
        # do a presence of all elements with id="variables" then using XPATH, find a child path in all of these
        # to the span element inside and extract the text saved inside each of them to determine if it equals:
        # "Conversation Tags". When you find that one, find the
        # title="Expand" button that is inside the id="variables" using XPATH and Click the button
        
        # variables = self.wait.until(EC.presence_of_all_elements_located((By.ID, "variables")))
        # self.assertTrue(variables, "Variables elements should be present")

        # for variable in variables:
        #     span_text = variable.find_element(By.XPATH, ".//span").text
        #     print("Test 1")
        #     if span_text == "Conversation Tags":
        #         print("Test 2")
        #         expand_button = variable.find_element(By.XPATH, './/button[@title="Expand"]')
        #         expand_button.click()
        #         break
        