import unittest
import time
import os
from dotenv import load_dotenv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    UnexpectedAlertPresentException,
    NoSuchElementException,
)
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest
from selenium.webdriver.support.ui import Select


class AccountModalTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=False)
        
    
    # ----------------- Setup Test Data ------------------
    def settings_admin_interface_supported_models(self):

        time.sleep(5)

        user_menu = self.wait.until(EC.presence_of_element_located((By.ID, "userMenu")))
        self.assertTrue(user_menu, "User Menu button is present")
        user_menu.click()
        time.sleep(3)

        settings_select = self.wait.until(EC.presence_of_element_located((By.ID, "adminInterface")))
        self.assertTrue(settings_select, "The Admin button should be present")
        settings_select.click()
        time.sleep(7)
        
        admin_tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(admin_tabs), 1, "Expected multiple buttons with ID 'tabName'")
        admin_supported_models_tab = next((tab for tab in admin_tabs if tab.text == "Supported Models"), None)
        self.assertIsNotNone(admin_supported_models_tab, "The 'Supported Models' tab should be present")
        admin_supported_models_tab.click()
        
        time.sleep(5)

    # ----------------- Test Supported Models -----------------
    def test_view_models(self):
        
        self.settings_admin_interface_supported_models()
        
        user_model_select = self.wait.until(
            EC.presence_of_element_located((By.ID, "UserModel"))
        )
        self.assertIsNotNone(user_model_select, "User Model Select is visible and clicking it shows options")
        user_model_select.click()
        
        time.sleep(2)
        
        advanced_model_select = self.wait.until(
            EC.presence_of_element_located((By.ID, "AdvancedModel"))
        )
        self.assertIsNotNone(advanced_model_select, "Advanced Model Select is visible and clicking it shows options")
        advanced_model_select.click()

        time.sleep(2)
        
        cheapest_model_select = self.wait.until(
            EC.presence_of_element_located((By.ID, "CheapestModel"))
        )
        self.assertIsNotNone(cheapest_model_select, "Cheapest Model Select is visible and clicking it shows options")
        cheapest_model_select.click()
        
        time.sleep(2)
        
        agent_model_select = self.wait.until(
            EC.presence_of_element_located((By.ID, "AgentModel"))
        )
        self.assertIsNotNone(agent_model_select, "Agent Model Select is visible and clicking it shows options")
        agent_model_select.click()
        
        time.sleep(2)
        
        embeddings_model_select = self.wait.until(
            EC.presence_of_element_located((By.ID, "EmbeddingsModel"))
        )
        self.assertIsNotNone(embeddings_model_select, "Embeddings Model Select is visible and clicking it shows options")
        embeddings_model_select.click()
        
        time.sleep(2)
        
    # ----------------- Test Add Model -----------------
    def test_add_model(self):
        
        self.settings_admin_interface_supported_models()
        
        add_model_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addModel"))
        )
        self.assertIsNotNone(add_model_button, "Add Model Button can be clicked")
        add_model_button.click()
        
        time.sleep(2)
        
        # Enter string and confirm id="supportedModels-id" exists
        supported_model_id = self.wait.until(
            EC.presence_of_element_located((By.ID, "supportedModels-id"))
        )
        supported_model_id.clear()
        supported_model_id.send_keys("Dash-Master-has-a-statue-in-fungal-waste")
        
        time.sleep(2)
        
        # Enter string and confirm id="supportedModels-name" exists
        supported_model_name = self.wait.until(
            EC.presence_of_element_located((By.ID, "supportedModels-name"))
        )
        supported_model_name.clear()
        supported_model_name.send_keys("Dash Master")
        
        time.sleep(2)
        
        # Enter string and confirm id="supportedModels-description" exists
        supported_model_description = self.wait.until(
            EC.presence_of_element_located((By.ID, "supportedModels-description"))
        )
        supported_model_description.clear()
        supported_model_description.send_keys("Dash Master... he's a speedy guy")
        
        time.sleep(2)
        
        # Enter string and confirm id="supportedModels-systemPrompt" exists
        supported_model_system_prompt = self.wait.until(
            EC.presence_of_element_located((By.ID, "supportedModels-systemPrompt"))
        )
        supported_model_system_prompt.clear()
        supported_model_system_prompt.send_keys("Lost Kin is a friend of his")
        
        time.sleep(2)
        
        # id={`provider${p}`} "providerAzure", "providerOpenAI", "providerBedrock"
        provider_azure_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "providerAzure"))
        )
        self.assertIsNotNone(provider_azure_button, "Provider Azure Button can be clicked")
        provider_azure_button.click()
        
        time.sleep(2)
        
        provider_openai_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "providerOpenAI"))
        )
        self.assertIsNotNone(provider_openai_button, "Provider OpenAI Button can be clicked")
        provider_openai_button.click()
        
        time.sleep(2)
        
        provider_bedrock_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "providerBedrock"))
        )
        self.assertIsNotNone(provider_bedrock_button, "Provider Bedrock Button can be clicked")
        provider_bedrock_button.click()
        
        time.sleep(2)
        
        # Enter number and confirm id="inputContextWindowInput" exists
        input_context_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "inputContextWindowInput"))
        )
        input_context_window.clear()
        input_context_window.send_keys(5)
        
        time.sleep(2)
        
        # Enter number and confirm id="inputTokenCostInput" exists
        input_token_cost = self.wait.until(
            EC.presence_of_element_located((By.ID, "inputTokenCostInput"))
        )
        input_token_cost.clear()
        input_token_cost.send_keys(4)
        
        time.sleep(2)
        
        # Enter number and confirm id="outputTokenLimitInput" exists
        output_token_limit = self.wait.until(
            EC.presence_of_element_located((By.ID, "outputTokenLimitInput"))
        )
        output_token_limit.clear()
        output_token_limit.send_keys(3)
        
        time.sleep(2)
        
        # Enter number and confirm id="outputTokenCostInput" exists
        output_token_cost = self.wait.until(
            EC.presence_of_element_located((By.ID, "outputTokenCostInput"))
        )
        output_token_cost.clear()
        output_token_cost.send_keys(2)
        
        time.sleep(2)
        
        # Enter number and confirm id="cachedTokenCostInput" exists
        cached_token_cost = self.wait.until(
            EC.presence_of_element_located((By.ID, "cachedTokenCostInput"))
        )
        cached_token_cost.clear()
        cached_token_cost.send_keys(1)
        
        time.sleep(2)
        
        supports_system_prompts_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "supportsSystemPrompts"))
        )
        self.assertIsNotNone(supports_system_prompts_button, "Supports System Prompts Button can be clicked")
        supports_system_prompts_button.click()
        
        time.sleep(2)
        
        supports_reasoning_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "supportsReasoning"))
        )
        self.assertIsNotNone(supports_reasoning_button, "Supports Reasoning Button can be clicked")
        supports_reasoning_button.click()
        
        time.sleep(2)
        
        supports_images_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "supportsImages"))
        )
        self.assertIsNotNone(supports_images_button, "Supports Images Button can be clicked")
        supports_images_button.click()
        
        time.sleep(2)
        
        is_available_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "isAvailable"))
        )
        self.assertIsNotNone(is_available_button, "Is Available Button can be clicked")
        is_available_button.click()
        
        time.sleep(2)
        
        cancel_action_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancelAction"))
        )
        self.assertIsNotNone(cancel_action_button, "Cancel Action Admin Add Button can be clicked")
        cancel_action_button.click()
        
        time.sleep(2)
        
        # Locate and click the Cancel button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Confirmation Button elements should be initialized")
        
        cancel_button = next((el for el in confirmation_button if el.text == "Close"), None)
        self.assertIsNotNone(cancel_button, "Close button should be present")
        
        cancel_button.click()
        
        time.sleep(3)
        
    # ----------------- Test Table Presence -----------------
    def test_table_presence(self):
        
        self.settings_admin_interface_supported_models()
        
        supported_model_table = self.wait.until(
            EC.presence_of_element_located((By.ID, "supportedModelsTable"))
        )
        self.assertIsNotNone(supported_model_table, "The supported model table is visible")
        
        supported_model_name = self.wait.until(
            EC.presence_of_element_located((By.ID, "Name"))
        )
        self.assertIsNotNone(supported_model_name, "Supported Model Name title in table is visible")
        
        supported_model_id = self.wait.until(
            EC.presence_of_element_located((By.ID, "ID"))
        )
        self.assertIsNotNone(supported_model_id, "ID title in table is visible")
        
        supported_model_provider = self.wait.until(
            EC.presence_of_element_located((By.ID, "Provider"))
        )
        self.assertIsNotNone(supported_model_provider, "Provider title in table is visible")
        
        supported_model_available = self.wait.until(
            EC.presence_of_element_located((By.ID, "Available"))
        )
        self.assertIsNotNone(supported_model_available, "Available title in table is visible")
        
        supported_model_images = self.wait.until(
            EC.presence_of_element_located((By.ID, "Supports Images"))
        )
        self.assertIsNotNone(supported_model_images, "Supports Images title in table is visible")
        
        supported_model_reasoning = self.wait.until(
            EC.presence_of_element_located((By.ID, "Supports Reasoning"))
        )
        self.assertIsNotNone(supported_model_reasoning, "Supports Reasoning title in table is visible")
        
        supported_model_system_prompts = self.wait.until(
            EC.presence_of_element_located((By.ID, "Supports System Prompts"))
        )
        self.assertIsNotNone(supported_model_system_prompts, "Supports System Prompts title in table is visible")
        
        supported_model_additional_system_prompts = self.wait.until(
            EC.presence_of_element_located((By.ID, "Additional System Prompt"))
        )
        self.assertIsNotNone(supported_model_additional_system_prompts, "Additional System Prompt title in table is visible")
        
        supported_model_descriptions = self.wait.until(
            EC.presence_of_element_located((By.ID, "Description"))
        )
        self.assertIsNotNone(supported_model_descriptions, "Supported Model Description title in table is visible")
        
        supported_model_input_context_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "Input Context Window"))
        )
        self.assertIsNotNone(supported_model_input_context_window, "Input Context Window title in table is visible")
        
        supported_model_output_token_limit = self.wait.until(
            EC.presence_of_element_located((By.ID, "Output Token Limit"))
        )
        self.assertIsNotNone(supported_model_output_token_limit, "Output Token Limit title in table is visible")
        
        supported_model_input_token_cost = self.wait.until(
            EC.presence_of_element_located((By.ID, "Input Token Cost / 1k"))
        )
        self.assertIsNotNone(supported_model_input_token_cost, "Input Token Cost / 1k title in table is visible")
        
        supported_model_output_token_cost = self.wait.until(
            EC.presence_of_element_located((By.ID, "Output Token Cost / 1k"))
        )
        self.assertIsNotNone(supported_model_output_token_cost, "Output Token Cost / 1k title in table is visible")
        
        supported_model_cached_token_cost = self.wait.until(
            EC.presence_of_element_located((By.ID, "Cached Token Cost / 1k"))
        )
        self.assertIsNotNone(supported_model_cached_token_cost, "Cached Token Cost / 1k title in table is visible")
        
        supported_model_available_via_membership = self.wait.until(
            EC.presence_of_element_located((By.ID, "Available to User via Amplify Group Membership"))
        )
        self.assertIsNotNone(supported_model_available_via_membership, "Available to User via Amplify Group Membership title in table is visible")
        
        time.sleep(2)
    
    # ----------------- Test Search Individual -----------------
    def test_search_individual(self):
        
        self.settings_admin_interface_supported_models()
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'supportedModelTitle'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "supportedModelTitle"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ['Ada-Embedding-002', 'Claude 3 Haiku', 'Claude 3 Opus', 'Claude 3 Sonnet', 'Claude 3.5 Haiku', 'Claude 3.5 Sonnet', 'Claude 3.5 Sonnet V2', 'Claude 3.7 Sonnet', 'Claude 4 Opus', 'Claude 4 Sonnet', 'DeepSeek r1', 'Gemini 2.0 Flash', 'Gemini 2.5 Pro', 'GPT-3.5-Turbo', 'GPT-4-Turbo', 'GPT-4.1-mini', 'GPT-4o', 'GPT-4o-mini', 'Llama 3.2 90b instruct', 'Mistra Pixtral Large', 'Mistral 7B', 'Mistral Large', 'Mixtral 8*7B', 'Nova Lite', 'Nova Lite', 'Nova Micro', 'Nova Premier', 'Nova Pro', 'Nova Pro', 'o1', 'o1 Mini', 'o1 Preview', 'o3', 'o3 mini', 'o4 mini', 'text-embedding-3-large', 'text-embedding-3-small', 'Titan-Embed-Text-v1']

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
        time.sleep(2)
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("GPT-4-Turbo")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'supportedModelTitle'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "supportedModelTitle"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ["GPT-4-Turbo"]  # Update with your actual expected names

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
    # ----------------- Test Search Multiple -----------------
    def test_search_multiple(self):
        
        self.settings_admin_interface_supported_models()
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'supportedModelTitle'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "supportedModelTitle"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ['Ada-Embedding-002', 'Claude 3 Haiku', 'Claude 3 Opus', 'Claude 3 Sonnet', 'Claude 3.5 Haiku', 'Claude 3.5 Sonnet', 'Claude 3.5 Sonnet V2', 'Claude 3.7 Sonnet', 'Claude 4 Opus', 'Claude 4 Sonnet', 'DeepSeek r1', 'Gemini 2.0 Flash', 'Gemini 2.5 Pro', 'GPT-3.5-Turbo', 'GPT-4-Turbo', 'GPT-4.1-mini', 'GPT-4o', 'GPT-4o-mini', 'Llama 3.2 90b instruct', 'Mistra Pixtral Large', 'Mistral 7B', 'Mistral Large', 'Mixtral 8*7B', 'Nova Lite', 'Nova Lite', 'Nova Micro', 'Nova Premier', 'Nova Pro', 'Nova Pro', 'o1', 'o1 Mini', 'o1 Preview', 'o3', 'o3 mini', 'o4 mini', 'text-embedding-3-large', 'text-embedding-3-small', 'Titan-Embed-Text-v1']

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
        time.sleep(2)
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("GPT")
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'supportedModelTitle'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "supportedModelTitle"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ['GPT-3.5-Turbo', 'GPT-4-Turbo', 'GPT-4.1-mini', 'GPT-4o', 'GPT-4o-mini']

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
    # ----------------- Test Search None -----------------
    def test_search_none(self):
        
        self.settings_admin_interface_supported_models()
        
        time.sleep(2)
        
        # Wait for all matching elements with ID 'supportedModelTitle'
        search_results = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "supportedModelTitle"))
        )
        self.assertIsNotNone(search_results, "Search Results should be present")

        # Extract text from each result
        group_names = [element.text for element in search_results]

        # Expected group names
        expected_group_names = ['Ada-Embedding-002', 'Claude 3 Haiku', 'Claude 3 Opus', 'Claude 3 Sonnet', 'Claude 3.5 Haiku', 'Claude 3.5 Sonnet', 'Claude 3.5 Sonnet V2', 'Claude 3.7 Sonnet', 'Claude 4 Opus', 'Claude 4 Sonnet', 'DeepSeek r1', 'Gemini 2.0 Flash', 'Gemini 2.5 Pro', 'GPT-3.5-Turbo', 'GPT-4-Turbo', 'GPT-4.1-mini', 'GPT-4o', 'GPT-4o-mini', 'Llama 3.2 90b instruct', 'Mistra Pixtral Large', 'Mistral 7B', 'Mistral Large', 'Mixtral 8*7B', 'Nova Lite', 'Nova Lite', 'Nova Micro', 'Nova Premier', 'Nova Pro', 'Nova Pro', 'o1', 'o1 Mini', 'o1 Preview', 'o3', 'o3 mini', 'o4 mini', 'text-embedding-3-large', 'text-embedding-3-small', 'Titan-Embed-Text-v1']

        # Assert that the group_names match the expected list
        self.assertListEqual(
            sorted(group_names),
            sorted(expected_group_names),
            f"Expected group names {expected_group_names}, but got {group_names}"
        )
        
        time.sleep(2)
        
        # Search in the Search Bar for specifc groups
        search_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        search_input_field.clear()
        search_input_field.send_keys("Robin")
        
        time.sleep(2)

        # Attempt to locate elements with id='supportedModelTitle'
        supported_model_name_elements = self.driver.find_elements(By.ID, "supportedModelTitle")

        # Assert that the list is empty
        self.assertEqual(len(supported_model_name_elements), 0, "No supportedModelTitle elements should be present")
        

if __name__ == "__main__":
    unittest.main(verbosity=2)