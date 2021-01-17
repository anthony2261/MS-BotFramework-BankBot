// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { InputHints, MessageFactory } = require('botbuilder');
const { ConfirmPrompt, TextPrompt, WaterfallDialog, NumberPrompt } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { DateResolverDialog } = require('./dateResolverDialog');
const { TextAnalyticsClient, AzureKeyCredential } = require('@azure/ai-text-analytics');
const moment = require('moment-timezone');

const CONFIRM_PROMPT = 'confirmPrompt';
const DATE_RESOLVER_DIALOG = 'dateResolverDialog';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';
const NUMBER_PROMPT = 'NUMBER_PROMPT';

const path = require('path');
const ENV_FILE = path.join(path.dirname(__dirname), '.env'); //path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });
const textAnalyticsClient = new TextAnalyticsClient(process.env.COG_Endpoint, new AzureKeyCredential(process.env.COG_SUB_KEY));

class SurveyDialog extends CancelAndHelpDialog {
    constructor(id, userState) {
        super(id || 'surveyDialog');

        this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.amountPromptValidator));

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new DateResolverDialog(DATE_RESOLVER_DIALOG))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.confirmStep.bind(this),
                this.amountStep.bind(this),
                this.commentStep.bind(this),
                // this.originStep.bind(this),
                // this.travelDateStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
        this.userState = userState;
    }

    async confirmStep(stepContext) {
        // Capture the results of the previous step
        // transactionDetails.number = stepContext.result;
        const messageText = 'Would you like to take a survey?';
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * If a destination city has not been provided, prompt for one.
     */
    async amountStep(stepContext) {
        if (stepContext.result === true) {
            const promptOptions = { prompt: 'How would you rate our services? (From 0 to 5)', retryPrompt: 'The value entered must be between 0 and 5.' };
            return await stepContext.prompt(NUMBER_PROMPT, promptOptions);
        }
        return await stepContext.endDialog();
    }

    async commentStep(stepContext) {
        const messageText = 'Please enter any comment you might have.';
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
    }

    /**
     * If an origin city has not been provided, prompt for one.
     */
    // async originStep(stepContext) {
    //     const bookingDetails = stepContext.options;

    //     // Capture the response to the previous step's prompt
    //     bookingDetails.destination = stepContext.result;
    //     if (!bookingDetails.origin) {
    //         const messageText = 'From what city will you be travelling?';
    //         const msg = MessageFactory.text(messageText, 'From what city will you be travelling?', InputHints.ExpectingInput);
    //         return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
    //     }
    //     return await stepContext.next(bookingDetails.origin);
    // }

    /**
     * If a travel date has not been provided, prompt for one.
     * This will use the DATE_RESOLVER_DIALOG.
     */
    // async travelDateStep(stepContext) {
    //     const bookingDetails = stepContext.options;

    //     // Capture the results of the previous step
    //     bookingDetails.origin = stepContext.result;
    //     if (!bookingDetails.travelDate || this.isAmbiguous(bookingDetails.travelDate)) {
    //         return await stepContext.beginDialog(DATE_RESOLVER_DIALOG, { date: bookingDetails.travelDate });
    //     }
    //     return await stepContext.next(bookingDetails.travelDate);
    // }

    /**
     * Confirm the information the user has provided.
     */

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        // if (stepContext.result === true) {
        //     const transactionDetails = stepContext.options;
        //     // await stepContext.context.sendActivity(transactionDetails);
        //     // const msg = `result: ${ transactionDetails.number } `;
        //     // await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
        //     // let msg2 = `this userState account: ${ JSON.stringify(this.userState.account) } `;
        //     if ((this.userState.account.amount - transactionDetails.number) < 0) {
        //         const errormsg = 'Not enough funds in wallet';
        //         await stepContext.context.sendActivity(errormsg, errormsg, InputHints.IgnoringInput);
        //         return await stepContext.endDialog(transactionDetails);
        //     } else {
        //         this.userState.account.amount = this.userState.account.amount - transactionDetails.number;
        //         this.userState.transactions[Object.keys(this.userState.transactions).length] = {
        //             amount: transactionDetails.number,
        //             status: 'In Process',
        //             time: moment().format('MMMM D, YYYY')
        //         };
        //         const successmsg = `Sending $${ transactionDetails.number }. Remaining balance: ${ this.userState.account.amount }`;
        //         await stepContext.context.sendActivity(successmsg, successmsg, InputHints.IgnoringInput);
        //         return await stepContext.endDialog(transactionDetails);
        //     }

        //     // let msg3 = `this userState transactions length: ${ Object.keys(this.userState.transactions).length } `;
        //     // let msg4 = `this userState transactions: ${ JSON.stringify(this.userState.transactions) } `;
        //     // let msg4 = `this userState transactions: ${ JSON.stringify(this.userState.transactions) } `;
        //     // await stepContext.context.sendActivity(msg2, msg2, InputHints.IgnoringInput);
        //     // await stepContext.context.sendActivity(msg3, msg3, InputHints.IgnoringInput);
        //     // await stepContext.context.sendActivity(msg4, msg4, InputHints.IgnoringInput);
        //     // return await stepContext.endDialog(transactionDetails);
        // }
        const sentimentResult = await textAnalyticsClient.analyzeSentiment([stepContext.result]);
        const thankyoumsg = `Thank you for your participation! Message sentiment: ${ sentimentResult[0].sentiment }`;
        await stepContext.context.sendActivity(thankyoumsg, thankyoumsg, InputHints.IgnoringInput);
        return await stepContext.endDialog();
    }

    async amountPromptValidator(promptContext) {
        // This condition is our validation rule. You can also change the value at this point.
        return promptContext.recognized.succeeded && promptContext.recognized.value >= 0 && promptContext.recognized.value <= 5;
    }
}

module.exports.SurveyDialog = SurveyDialog;
