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

class DownloadModalTests(unittest.TestCase):
    
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
            

            
    def create_chat(self, chat_name):
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
        rename_field.clear()
        rename_field.send_keys(chat_name)
        rename_confirm_button = self.wait.until(EC.element_to_be_clickable((By.ID, "handleConfirm")))
        self.assertIsNotNone(rename_confirm_button, "Rename confirm button should be initialized and clicked")
        rename_confirm_button.click()
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        folder = next((el for el in drop_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(folder, "New Conversation button should be present")
        
        
    # ----------------- Setup Test Data ------------------
    def send_message(self, chat_name, message):
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with chat name
        chat = next((el for el in chat_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(chat, "Chat button should be present")
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(15)            
            
# id="confirmationButton"
# id="optionsGrid"
# id="assistantHeaderText"
# id="userMessageHeaderText"
# id="messageHeaderText"
# id="conversationHeaderText"
# id="includeSelection"
# id="convoNameInclusionSelection"
# id="templateSelection"
# id="formatSelection"

# Go through the download chat template and test every field

    # ----------------- Test Download Chat Modal Fields -----------------
    def test_download_chat_modal_fields(self):
        
        # Create a chat
        self.create_chat("Kazuya")
        
        # Send a Message
        self.send_message("Kazuya", "Kazuya Mishima... Wins...")
        
        upper_chat_download = self.wait.until(EC.presence_of_element_located((By.ID, "downloadUpper")))
        self.assertTrue(upper_chat_download, "Upper Chat Download button should be initialized")
        upper_chat_download.click()
        
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        download_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = 0;", download_scroll_window)
        
        time.sleep(2)
        
        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element.is_displayed(), "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="formatSelection"
        # Verify the presence of the select element
        format_selection = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        self.assertTrue(format_selection.is_displayed(), "Format selection dropdown is visible")

        # Verify the presence of "Word" and "PowerPoint" options
        format_options = format_selection.find_elements(By.TAG_NAME, "option")
        format_values = [option.text for option in format_options]
        self.assertIn("Word", format_values, "Word format should be selectable")
        self.assertIn("PowerPoint", format_values, "PowerPoint format should be selectable")

        time.sleep(3)

        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        # Select "PowerPoint" and verify "vapor.pptx" is an option
        format_selection.select_by_visible_text("PowerPoint")

        pptx_template_options = [option.text for option in template_selection.options]
        self.assertIn("vapor.pptx", pptx_template_options, "vapor.pptx template should be selectable when PowerPoint is selected")

        time.sleep(3)

        # id="convoNameInclusionSelection"
        # Verify "Yes" and "No" options are selectable
        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        convo_options = [option.text for option in convo_name_selection.find_elements(By.TAG_NAME, "option")]
        self.assertIn("Yes", convo_options, "Yes option should be present in convoNameInclusionSelection")
        self.assertIn("No", convo_options, "No option should be present in convoNameInclusionSelection")

        time.sleep(3)

        # id="includeSelection"
        # Verify "Assistant Messages", "User Prompts", and "All Messages & Prompts" options
        include_selection = self.wait.until(EC.presence_of_element_located((By.ID, "includeSelection")))
        include_options = [option.text for option in include_selection.find_elements(By.TAG_NAME, "option")]
        self.assertIn("Assistant Messages", include_options, "Assistant Messages option should be present")
        self.assertIn("User Prompts", include_options, "User Prompts option should be present")
        self.assertIn("All Messages & Prompts", include_options, "All Messages & Prompts option should be present")

        time.sleep(3)

        # id="conversationHeaderText"
        # Enter text into the textarea
        convo_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "conversationHeaderText")))
        convo_header_textarea = convo_header_div.find_element(By.TAG_NAME, "textarea")
        convo_header_textarea.send_keys("This is my conversation header")

        time.sleep(3)

        # id="messageHeaderText"
        message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "messageHeaderText")))
        message_header_textarea = message_header_div.find_element(By.TAG_NAME, "textarea")
        message_header_textarea.send_keys("This is my message header")

        time.sleep(3)

        # id="userMessageHeaderText"
        user_message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "userMessageHeaderText")))
        user_message_header_textarea = user_message_header_div.find_element(By.TAG_NAME, "textarea")
        user_message_header_textarea.send_keys("This is my user message header")

        time.sleep(3)

        # id="assistantHeaderText"
        assistant_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "assistantHeaderText")))
        assistant_header_textarea = assistant_header_div.find_element(By.TAG_NAME, "textarea")
        assistant_header_textarea.send_keys("This is my assistant header")

        time.sleep(3)

        # id="confirmationButton"
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")


    # ----------------- Test Download Chat -----------------
    def test_download_chat(self):
        
        # Create a chat
        self.create_chat("Jin")
        
        # Send a Message
        self.send_message("Jin", "Jin Kazama... Wins...")
        
        upper_chat_download = self.wait.until(EC.presence_of_element_located((By.ID, "downloadUpper")))
        self.assertTrue(upper_chat_download, "Upper Chat Download button should be initialized")
        upper_chat_download.click()
        
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        download_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = 0;", download_scroll_window)
        
        time.sleep(2)
        
        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element.is_displayed(), "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="formatSelection"
        # Verify the presence of the select element
        format_selection = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        self.assertTrue(format_selection.is_displayed(), "Format selection dropdown is visible")

        # Verify the presence of "Word" and "PowerPoint" options
        format_options = format_selection.find_elements(By.TAG_NAME, "option")
        format_values = [option.text for option in format_options]
        self.assertIn("Word", format_values, "Word format should be selectable")
        self.assertIn("PowerPoint", format_values, "PowerPoint format should be selectable")

        time.sleep(3)

        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        # id="convoNameInclusionSelection"
        # Verify "Yes" and "No" options are selectable
        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        specific_name_selection = Select(convo_name_selection.find_element(By.TAG_NAME, "select"))
        specific_name_selection.select_by_visible_text("Yes")

        time.sleep(3)

        # id="conversationHeaderText"
        # Enter text into the textarea
        convo_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "conversationHeaderText")))
        convo_header_textarea = convo_header_div.find_element(By.TAG_NAME, "textarea")
        convo_header_textarea.send_keys("Convo with Jin")

        time.sleep(3)

        # id="messageHeaderText"
        message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "messageHeaderText")))
        message_header_textarea = message_header_div.find_element(By.TAG_NAME, "textarea")
        message_header_textarea.send_keys("Hello Hello")

        time.sleep(3)

        # id="userMessageHeaderText"
        user_message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "userMessageHeaderText")))
        user_message_header_textarea = user_message_header_div.find_element(By.TAG_NAME, "textarea")
        user_message_header_textarea.send_keys("How are you this fine day?")

        time.sleep(3)

        # id="assistantHeaderText"
        assistant_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "assistantHeaderText")))
        assistant_header_textarea = assistant_header_div.find_element(By.TAG_NAME, "textarea")
        assistant_header_textarea.send_keys("I am here to assist you.")

        time.sleep(3)

        # id="confirmationButton"
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for the load
        
        download_click = self.wait.until(EC.presence_of_element_located((By.ID, "downloadClick")))
        self.assertTrue(download_click.is_displayed(), "Download click is visible")
        download_click.click()
        
        time.sleep(5) # View Download visible
        
        

# Go through the download response template and test every field
# ----------------- Test Download Response Modal Fields -----------------

    def test_download_response_modal_fields(self):
        # Create a chat
        self.create_chat("Mario")
        
        # Send a Message
        self.send_message("Mario", "MAAAAAARRRIOOO TIIIIIMMEE!!!")
        
        # Hover the chat response
        chat_hover = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatHover")
        ))
        self.assertGreater(len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'")
        
        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()
        
        time.sleep(3)
        
        # Click the download button
        download_button = self.driver.find_element("id", "downloadResponse")
        download_button.click()

        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element.is_displayed(), "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="formatSelection"
        # Verify the presence of the select element
        format_selection = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        self.assertTrue(format_selection.is_displayed(), "Format selection dropdown is visible")

        # Verify the presence of "Word" and "PowerPoint" options
        format_options = format_selection.find_elements(By.TAG_NAME, "option")
        format_values = [option.text for option in format_options]
        self.assertIn("Word", format_values, "Word format should be selectable")
        self.assertIn("PowerPoint", format_values, "PowerPoint format should be selectable")

        time.sleep(3)

        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        # Select "PowerPoint" and verify "vapor.pptx" is an option
        format_selection.select_by_visible_text("PowerPoint")

        pptx_template_options = [option.text for option in template_selection.options]
        self.assertIn("vapor.pptx", pptx_template_options, "vapor.pptx template should be selectable when PowerPoint is selected")

        time.sleep(3)

        # id="convoNameInclusionSelection"
        # Verify "Yes" and "No" options are selectable
        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        convo_options = [option.text for option in convo_name_selection.find_elements(By.TAG_NAME, "option")]
        self.assertIn("Yes", convo_options, "Yes option should be present in convoNameInclusionSelection")
        self.assertIn("No", convo_options, "No option should be present in convoNameInclusionSelection")

        time.sleep(3)

        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")
        
        close = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="Close"]'
        )))
        self.assertTrue(close.is_displayed(), "Close button is visible")
        
        close.click()
        
        time.sleep(3)



# ----------------- Test Download Response Modal -----------------
    def test_download_response_modal(self):
        # Create a chat
        self.create_chat("Luigi")
        
        # Send a Message
        self.send_message("Luigi", "LUUIGIII TIIIIIMMEE!!!")
        
        # Hover the chat response
        chat_hover = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatHover")
        ))
        self.assertGreater(len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'")
        
        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()
        
        time.sleep(3)
        
        # Click the download button
        download_button = self.driver.find_element("id", "downloadResponse")
        download_button.click()
        
        # Verify the presence of the download modal after clicking the downloadResponse button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element.is_displayed(), "Download window element is visible")
        
        time.sleep(3)
        
        # Extract the text from the element
        modal_text = download_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        specific_name_selection = Select(convo_name_selection.find_element(By.TAG_NAME, "select"))
        specific_name_selection.select_by_visible_text("Yes")

        time.sleep(3)

        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for the load
        
        download_click = self.wait.until(EC.presence_of_element_located((By.ID, "downloadClick")))
        self.assertTrue(download_click.is_displayed(), "Download click is visible")
        download_click.click()
        
        time.sleep(5) # View Download visible
        

if __name__ == "__main__":
    unittest.main(verbosity=2)