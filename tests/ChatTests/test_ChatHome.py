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
from tests.base_test import BaseTest

class ChatHomeTests(BaseTest):
    
    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")
        folder_add_buttons[0].click()
        
        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.send_keys(folder_name)
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
            
    def click_assistants_tab(self):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()

        time.sleep(2)
    
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

    # ----------------- Send Chat -----------------
    """This tests the chat bar and that a message can be sent."""
    
    def test_send_chat(self):
        
        # Create a chat
        self.create_chat("Wario")
        
        # Send a Message
        self.send_message("Wario", "WAAAAAAARIO TIIIIIIIME!!!")
        
        
    # ----------------- Test Change Model -----------------
    """This test ensures that in the chat settings you can change each of the different models
       and that all of the models are present."""
    
    def test_change_model(self):
        # Model ID to Model Name mapping
        model_ids = [
            "anthropic.claude-3-haiku-20240307-v1:0",
            "us.anthropic.claude-3-opus-20240229-v1:0",
            "anthropic.claude-3-sonnet-20240229-v1:0",
            "anthropic.claude-3-5-sonnet-20240620-v1:0",
            "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            "us.deepseek.r1-v1:0",
            "gpt-4o",
            "gpt-4o-mini",
            "us.meta.llama3-2-90b-instruct-v1:0",
            "mistral.mistral-7b-instruct-v0:2",
            "mistral.mistral-large-2402-v1:0",
            "mistral.mixtral-8x7b-instruct-v0:1",
            "o1-mini",
            "o1-preview",
        ]

        model_names = [
            "Claude 3 Haiku",
            "Claude 3 Opus",
            "Claude 3 Sonnet",
            "Claude 3.5 Sonnet",
            "Claude 3.5 Sonnet V2",
            "Claude 3.7 Sonnet",
            "DeepSeek r1",
            "GPT-4o",
            "GPT-4o-mini\n(Default)",
            "Llama 3.2 90b instruct",
            "Mistral 7B",
            "Mistral Large",
            "Mixtral 8*7B",
            "o1 Mini",
            "o1 Preview",
        ]
        
        # Loop through each model ID and name
        for model_id, model_name in zip(model_ids, model_names):
            
            # Click the Model Select Button
            model_select_button = self.wait.until(EC.presence_of_element_located((By.ID, "modelSelect")))
            self.assertTrue(model_select_button.is_displayed(), "Model Select Button is visible")
            
            # Open the model dropdown
            model_select_button.click()
            
            time.sleep(1)

            # Click the specific model by ID
            model_option = self.wait.until(EC.presence_of_element_located((By.ID, model_id)))
            model_option.click()
            
            time.sleep(1)

            # Wait for the selected model to appear in the span element
            selected_model = model_select_button.find_element(By.TAG_NAME, "span") 
            selected_model_text = selected_model.text.strip()
            
            time.sleep(1)

            # Assert that the selected model matches the expected name
            self.assertEqual(model_name, selected_model_text, f"{model_name} should be selected")
            
        # Click the Model Select Button
        model_select_button = self.wait.until(EC.presence_of_element_located((By.ID, "modelSelect")))
        self.assertTrue(model_select_button.is_displayed(), "Model Select Button is visible")
        
        # Open the model dropdown
        model_select_button.click()
        
        time.sleep(1)

        # Click the specific model by ID
        model_option = self.wait.until(EC.presence_of_element_located((By.ID, "gpt-4o-mini")))
        model_option.click()
        
        time.sleep(1)
    
    # ----------------- Test Store Conversation To Cloud -----------------
    """This test ensures that you can store a conversation to the cload by clicking the 
       save to cloud button"""
    
    def test_store_convo_in_cloud(self):
        # Locate the "Store to Cloud" button (with the title attribute)
        store_button = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="This conversation is currently set to private and only accessible from this browser. "]'
        )))
        self.assertTrue(store_button.is_displayed(), "Store to Cloud button is visible")
        
        time.sleep(1)
        
        # Click the button
        store_button.click()
        
        time.sleep(1)
        
        # Handle JavaScript alert
        alert = self.wait.until(EC.alert_is_present())
        alert.accept()

        # Give the UI time to update (wait for visibility change)
        time.sleep(5)  # This can be replaced with an explicit wait later
        
    # ----------------- Test Advanced Conversation Settings -----------------
    """This test ensures that the Advanced Conversation Settings can by viewed."""
    
    def test_advanced_convo_settings(self):
        # Click the Advanced Conversation Settings button
        advanced_settings_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
        )
        self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")

        advanced_settings_button.click()

        # Wait for the custom instructions section to be visible
        custom_instructions = self.wait.until(
            EC.presence_of_element_located((By.ID, "customInstructionsSelect"))
        )
        self.assertTrue(custom_instructions.is_displayed(), "Custom Instructions section is visible")

        time.sleep(3)  # Allow for UI to stabilize
        
    # ----------------- Test Change Custom Instructions -----------------
    """This test ensures that the custom instructions selection can be any of the assistants and prompts"""
    
    def test_custom_settings(self):
        self.click_assistants_tab()
        
        time.sleep(2)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Assistants"
        time.sleep(2)
        assistants_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistants_dropdown_button, "Assistants button should be present")

        # Click to open the dropdown
        assistants_dropdown_button.click()
        
        time.sleep(1)
        
        sidebar = self.wait.until(EC.presence_of_element_located((By.ID, "sidebarScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", sidebar)
        time.sleep(1)  # Optional: wait to ensure scrolling completes

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        custom_instructions_dropdown_button = next((el for el in drop_name_elements if el.text == "Custom Instructions"), None)
        self.assertIsNotNone(custom_instructions_dropdown_button, "Custom Instructions button should be present")

        custom_instructions_dropdown_button.click()

        time.sleep(2)

        # Save all of the elements with the id="assistantName" into a list of text strings
        assistant_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "assistantName")
        ))
        self.assertTrue(assistant_name_elements, "Prompt name elements should be initialized")

        # Extract the text from all assistantName elements and add 'Default' to the list
        prompt_names = [el.text for el in assistant_name_elements]
        prompt_names.append("Default")

        time.sleep(2)

        # Click the Advanced Conversation Settings button
        advanced_settings_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
        )
        self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")

        advanced_settings_button.click()

        # Wait for the custom instructions section to be visible
        custom_instructions = self.wait.until(
            EC.presence_of_element_located((By.ID, "customInstructionsSelect"))
        )
        self.assertTrue(custom_instructions.is_displayed(), "Custom Instructions section is visible")

        time.sleep(3)  # Allow for UI to stabilize

        # Extract all the options from the select element
        select_element = Select(custom_instructions)
        option_texts = [option.text for option in select_element.options]

        # Ensure the options in the select list match the prompt_names list
        print(prompt_names)
        print(option_texts)
        
        missing_items = set(prompt_names) - set(option_texts)
        print("Missing prompt names:", missing_items)
        
        self.assertTrue(set(prompt_names).issubset(set(option_texts)), "All prompt names should be present in the dropdown options")

    # ----------------- Test Temperature Slider -----------------
    """This test ensures that the interactive slider that measures the temperature of a response works
       as intended."""
    
    def test_temperature_slider(self):
        # Click the Advanced Conversation Settings button
        advanced_settings_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
        )
        self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")

        advanced_settings_button.click()
        
        time.sleep(3)
        
        # Locate all slider elements by ID
        sliders = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "slider"))
        )
        self.assertTrue(sliders, "Sliders should be present")

        # Use the first slider
        slider = sliders[0]
        self.assertTrue(slider.is_displayed(), "Temperature slider is visible")

        # Decrease the slider value from 1.0 to 0.0 in steps of 0.1
        for value in range(10, -1, -1):  # 10 to 0
            expected_value = value / 10.0  # Convert to float
            slider_value = slider.get_attribute("value")
            
            # Handle conversion issue for "1" vs "1.0" and "0" vs "0.0"
            if slider_value == "1":
                slider_value = 1.0
            elif slider_value == "0":
                slider_value = 0.0
            else:
                slider_value = float(slider_value)  # Convert normally for other values
            
            self.assertEqual(slider_value, expected_value, f"Slider value should be {expected_value}")
            slider.send_keys(Keys.ARROW_LEFT)  # Adjust slider
            time.sleep(1)  # Pause to observe 

    # ----------------- Test Length Slider -----------------
    """This test ensures that the interactive slider that measures the length of a response works
       as intended."""
    
    def test_length_slider(self):
        # Click the Advanced Conversation Settings button
        advanced_settings_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
        )
        self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")

        advanced_settings_button.click()
        
        time.sleep(2)
        
        # Scroll down to make sure the slider is in view
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "overflowScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_scroll_window)
        
        time.sleep(2)  # Allow time for scrolling
        
        # Locate all slider elements by ID
        sliders = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "slider"))
        )
        self.assertTrue(sliders, "Sliders should be present")

        # Use the last slider (length slider)
        length_slider = sliders[-1]
        self.assertTrue(length_slider.is_displayed(), "Length slider is visible")
        
        temp_rang = int(float(length_slider.get_attribute("value")) * 10)

        # Decrease the slider value from 3.0 to 0.0 in steps of 0.1
        for value in range(temp_rang, -1, -1):  # 3.0 to 0.0
            expected_value = str(value / 10) if value % 10 != 0 else str(int(value / 10))  # Format whole numbers
            slider_value = length_slider.get_attribute("value")

            # Handle conversion for whole numbers like "3" instead of "3.0"
            if slider_value.isdigit():
                slider_value = int(slider_value)
            else:
                slider_value = float(slider_value)

            self.assertEqual(slider_value, float(expected_value), f"Slider value should be {expected_value}")
            length_slider.send_keys(Keys.ARROW_LEFT)  # Move slider left
            time.sleep(0.5)  # Pause to observe

        time.sleep(3)

        # Increase the slider value from 0.0 to 6.0 in steps of 0.1
        for value in range(0, 61):  # 0.0 to 6.0
            expected_value = str(value / 10) if value % 10 != 0 else str(int(value / 10))  # Format whole numbers
            slider_value = length_slider.get_attribute("value")

            # Handle conversion for whole numbers like "3" instead of "3.0"
            if slider_value.isdigit():
                slider_value = int(slider_value)
            else:
                slider_value = float(slider_value)

            self.assertEqual(slider_value, float(expected_value), f"Slider value should be {expected_value}")
            length_slider.send_keys(Keys.ARROW_RIGHT)  # Move slider right
            time.sleep(0.5)  # Pause to observe


    # ----------------- Temporarily Depricated -----------------
    
    # # ----------------- Test Temperature Slider with chat -----------------
    # """This test ensures that the interactive slider that measures the temperature of a response works
    #    as intended with sending a chat"""
    
    # def test_temp_slider_with_chat(self):
        
    #     # Create a chat
    #     self.create_chat("DK")
        
    #     # Click the Advanced Conversation Settings button
    #     advanced_settings_button = self.wait.until(
    #         EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
    #     )
    #     self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")

    #     advanced_settings_button.click()
        
    #     time.sleep(2)  # Allow time for scrolling
        
    #     # Locate all slider elements by ID
    #     sliders = self.wait.until(
    #         EC.presence_of_all_elements_located((By.ID, "slider"))
    #     )
    #     self.assertTrue(sliders, "Sliders should be present")

    #     length_slider = sliders[0]
        
    #     # Move the slider down to 0.0
    #     for value in range(10, -1, -1):  # 1.0 to 0.0
    #         expected_value = str(value / 10) if value % 10 != 0 else str(int(value / 10))  # Format whole numbers
    #         slider_value = length_slider.get_attribute("value")

    #         # Handle conversion for whole numbers like "1" instead of "1.0"
    #         if slider_value.isdigit():
    #             slider_value = int(slider_value)
    #         else:
    #             slider_value = float(slider_value)

    #         self.assertEqual(slider_value, float(expected_value), f"Slider value should be {expected_value}")
    #         length_slider.send_keys(Keys.ARROW_LEFT)  # Move slider left
    #         time.sleep(0.5)  # Pause to observe
        
    #     # Send a Message
    #     self.send_message("DK", "Hello, how are you DK?")
        
    #     # Get chat content block element
    #     chat_content = self.driver.find_element("id", "chatContentBlock")
    #     expected_message_1 = chat_content.get_attribute("data-original-content")
        
    #     time.sleep(2)
        
    #     # Create a chat
    #     self.create_chat("DK2")
        
    #     # Check if any sliders are present
    #     sliders_present = self.driver.find_elements(By.ID, "slider")

    #     # If sliders are not present, click the Advanced Conversation Settings button
    #     if not sliders_present:
    #         advanced_settings_button = self.wait.until(
    #             EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
    #         )
    #         self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")
    #         advanced_settings_button.click()
        
    #     time.sleep(2)  # Allow time for scrolling
        
    #     # Locate all slider elements by ID
    #     sliders = self.wait.until(
    #         EC.presence_of_all_elements_located((By.ID, "slider"))
    #     )
    #     self.assertTrue(sliders, "Sliders should be present")

    #     length_slider = sliders[0]
        
    #     time.sleep(2)
        
    #     slider_value = length_slider.get_attribute("value")
        
    #     self.assertEqual(slider_value, '1', f"Slider value should be 1")
        
    #     # Send a Message
    #     self.send_message("DK2", "Hello, how are you DK?")
        
    #     # Get chat content block element
    #     chat_content = self.driver.find_element("id", "chatContentBlock")
    #     expected_message_2 = chat_content.get_attribute("data-original-content")
        
    #     self.assertNotEqual(expected_message_1, expected_message_2, "The two messages should not be equal")
    
    # ----------------- Test Length Slider with Chat -----------------
    """This test ensures that the interactive slider that measures the length of a response works
       as intended with sending a chat"""
       
    def test_length_slider_with_chat(self):
        
        # Create a chat
        self.create_chat("Climate Guy")
        
        # Click the Advanced Conversation Settings button
        advanced_settings_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
        )
        self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")

        advanced_settings_button.click()
        
        time.sleep(2)
        
        # Scroll down to make sure the slider is in view
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "overflowScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_scroll_window)
        
        time.sleep(2)  # Allow time for scrolling
        
        # Locate all slider elements by ID
        sliders = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "slider"))
        )
        self.assertTrue(sliders, "Sliders should be present")

        length_slider = sliders[-1]
        
        temp_rang = int(float(length_slider.get_attribute("value")) * 10)
        
        # Move the slider down to 0.0
        for value in range(temp_rang, -1, -1):  # 3.0 to 0.0
            expected_value = str(value / 10) if value % 10 != 0 else str(int(value / 10))  # Format whole numbers
            slider_value = length_slider.get_attribute("value")

            # Handle conversion for whole numbers like "3" instead of "3.0"
            if slider_value.isdigit():
                slider_value = int(slider_value)
            else:
                slider_value = float(slider_value)

            self.assertEqual(slider_value, float(expected_value), f"Slider value should be {expected_value}")
            length_slider.send_keys(Keys.ARROW_LEFT)  # Move slider left
            time.sleep(0.5)  # Pause to observe
        
        # Send a Message
        self.send_message("Climate Guy", "Can you provide an explanation about the impact of climate change?")
        
        time.sleep(15)
        
        # Get chat content block element
        chat_content = self.driver.find_element("id", "chatContentBlock")
        expected_message_1 = chat_content.get_attribute("data-original-content")
        
        time.sleep(2)
        
        # Create a chat
        self.create_chat("Climate Guy 2")
        
        # Check if any sliders are present
        sliders_present = self.driver.find_elements(By.ID, "slider")

        # If sliders are not present, click the Advanced Conversation Settings button
        if not sliders_present:
            advanced_settings_button = self.wait.until(
                EC.presence_of_element_located((By.ID, "advancedConversationSettings"))
            )
            self.assertTrue(advanced_settings_button.is_displayed(), "Advanced Conversation Settings button is visible")
            advanced_settings_button.click()
            
        time.sleep(2)
        
        # Scroll down to make sure the slider is in view
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "overflowScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_scroll_window)
        
        time.sleep(2)  # Allow time for scrolling
        
        # Locate all slider elements by ID
        sliders = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "slider"))
        )
        self.assertTrue(sliders, "Sliders should be present")

        length_slider = sliders[-1]
        
        time.sleep(2)
        
        # Increase the slider value from 0.0 to 6.0 in steps of 0.1
        for value in range(0, 61):  # 0.0 to 6.0
            expected_value = str(value / 10) if value % 10 != 0 else str(int(value / 10))  # Format whole numbers
            slider_value = length_slider.get_attribute("value")

            # Handle conversion for whole numbers like "3" instead of "3.0"
            if slider_value.isdigit():
                slider_value = int(slider_value)
            else:
                slider_value = float(slider_value)

            self.assertEqual(slider_value, float(expected_value), f"Slider value should be {expected_value}")
            length_slider.send_keys(Keys.ARROW_RIGHT)  # Move slider right
            time.sleep(0.5)  # Pause to observe
        
        # Send a Message
        self.send_message("Climate Guy 2", "Can you provide an explanation about the impact of climate change?")
        
        time.sleep(15)
        
        # Get chat content block element
        chat_content = self.driver.find_element("id", "chatContentBlock")
        expected_message_2 = chat_content.get_attribute("data-original-content")
        
        self.assertGreater(len(expected_message_2), len(expected_message_1), "expected_message_2 should be longer than expected_message_1")

    # ----------------- Test View Legend -----------------
    """This test ensures that the interactive legend that appears when you hover over it"""
    
    def test_legend_hover(self):
        
        # Click the Advanced Conversation Settings button
        legend_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "legendHover"))
        )
        self.assertTrue(legend_hover.is_displayed(), "The Legend pin is visible")
        
        # Hover over the "Going Merry" button to make the "Pin" button visible        
        action = ActionChains(self.driver)
        action.move_to_element(legend_hover).perform()
        
        time.sleep(2)
        
        # Click the Advanced Conversation Settings button
        legend = self.wait.until(
            EC.presence_of_element_located((By.ID, "modelLegend"))
        )
        self.assertTrue(legend.is_displayed(), "The Legend is visible")
    
    
if __name__ == "__main__":
    unittest.main(verbosity=2)
