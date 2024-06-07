import { Dispatch } from 'react';
import { FieldNames } from "@/hooks/useHomeReducer";
import { HomeInitialState } from "@/home/home.state";
import { checkDataDisclosureDecision, getLatestDataDisclosure, saveDataDisclosureDecision } from "@/services/dataDisclosureService";

interface DataDisclosureAction {
    type?: 'change';
    field: FieldNames<HomeInitialState>;
    value: any;
}

export const fetchDataDisclosureDecision = async (
    email: string,
    dispatch: Dispatch<DataDisclosureAction>
) => {
    if (!email) return;

    try {
        const decision = await checkDataDisclosureDecision(email);
        const decisionBodyObject = JSON.parse(decision.item.body);
        const decisionValue = decisionBodyObject.acceptedDataDisclosure;
        // console.log("Decision Value:", decisionValue);
        dispatch({ field: 'hasAcceptedDataDisclosure', value: decisionValue });

        if (!decisionValue) {
            const latestDisclosure = await getLatestDataDisclosure();
            const latestDisclosureBodyObject = JSON.parse(latestDisclosure.item.body);
            const latestDisclosureUrlPDF = latestDisclosureBodyObject.pdf_pre_signed_url;
            const latestDisclosureHTML = latestDisclosureBodyObject.html_content;
            dispatch({ field: 'latestDataDisclosureUrlPDF', value: latestDisclosureUrlPDF });
            dispatch({ field: 'latestDataDisclosureHTML', value: latestDisclosureHTML });
        }
    } catch (error) {
        console.error('Failed to check data disclosure decision:', error);
        dispatch({ field: 'hasAcceptedDataDisclosure', value: false });
    }
};
