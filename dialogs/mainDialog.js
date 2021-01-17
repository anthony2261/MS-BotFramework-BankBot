/* eslint-disable spaced-comment */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, CardFactory, InputHints } = require('botbuilder');
const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { ActionTypes } = require('botframework-schema');
// const moment = require('moment-timezone');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, transactionDialog, surveyDialog, userState) {
        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;

        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAEndpointHostName
        });

        this.qnaMaker = qnaMaker;

        if (!surveyDialog) throw new Error('[MainDialog]: Missing parameter \'surveyDialog\' is required');
        if (!transactionDialog) throw new Error('[MainDialog]: Missing parameter \'transactionDialog\' is required');
        if (!userState) throw new Error('[MainDialog]: Missing parameter \'userState\' is required');
        this.userState = userState;
        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(transactionDialog)
            .addDialog(surveyDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.surveyStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async introStep(stepContext) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        // const weekLaterDate = moment().add(7, 'days').format('MMMM D, YYYY');

        const mymessage = await this.sendSuggestedActions(stepContext);
        return await stepContext.prompt('TextPrompt', { prompt: mymessage });
        // eslint-disable-next-line quotes
        // const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : `What can I help you with today?\nYou can check your account and previous transactions, make a transaction, or ask general questions!`;
        // const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        // return await stepContext.prompt('TextPrompt', { prompt: promptMessage });

        // return await stepContext.next();
    }

    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
     */
    async actStep(stepContext) {
        const bookingDetails = {};

        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the BookingDialog path.
            return await stepContext.beginDialog('bookingDialog', bookingDetails);
        }
        //////////////////////
        const recognizerResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        const intent = LuisRecognizer.topIntent(recognizerResult);

        // Next, we call the dispatcher with the top intent.
        // await this.dispatchToTopIntentAsync(stepContext, intent, recognizerResult);
        switch (intent) {
        case 'l_Banking':
            return await this.processBanking(stepContext, recognizerResult.luisResult);
            // break;
        case 'q_banking-qna':
            await this.processBankingQnA(stepContext);
            break;
        default:
            console.log(`Dispatch unrecognized intent: ${ intent }.`);
            await stepContext.context.sendActivity(`Dispatch unrecognized intent: ${ intent }.`);
            break;
        }

        /////////////////
        // const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        // switch (LuisRecognizer.topIntent(luisResult)) {
        // case 'View Account': {

        //     // Initialize BookingDetails with any entities we may have found in the response.
        //     // bookingDetails.destination = toEntities.airport;
        //     // bookingDetails.origin = fromEntities.airport;
        //     // bookingDetails.travelDate = this.luisRecognizer.getTravelDate(luisResult);
        //     // console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

        //     // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
        //     const getWeatherMessageText = 'TODO: get account info here';
        //     await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
        //     break;

        // }
        // case 'BookFlight': {
        //     // Extract the values for the composite entities from the LUIS result.
        //     const fromEntities = this.luisRecognizer.getFromEntities(luisResult);
        //     const toEntities = this.luisRecognizer.getToEntities(luisResult);

        //     // Show a warning for Origin and Destination if we can't resolve them.
        //     await this.showWarningForUnsupportedCities(stepContext.context, fromEntities, toEntities);

        //     // Initialize BookingDetails with any entities we may have found in the response.
        //     bookingDetails.destination = toEntities.airport;
        //     bookingDetails.origin = fromEntities.airport;
        //     bookingDetails.travelDate = this.luisRecognizer.getTravelDate(luisResult);
        //     console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

        //     // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
        //     return await stepContext.beginDialog('bookingDialog', bookingDetails);
        // }

        // case 'GetWeather': {
        //     // We haven't implemented the GetWeatherDialog so we just display a TODO message.
        //     const getWeatherMessageText = 'TODO: get weather flow here';
        //     await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
        //     break;
        // }

        // default: {
        //     // Catch all for unhandled intents
        //     const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${ LuisRecognizer.topIntent(luisResult) })`;
        //     await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
        // }
        // }

        return await stepContext.next();
    }
    //////////////
    // async dispatchToTopIntentAsync(context, intent, recognizerResult) {

    // }
    async processBanking(stepContext, luisResult) {
        console.log('processBanking');
        // Retrieve LUIS result for Process Automation.
        const result = luisResult.connectedServiceResult;
        const intent = result.topScoringIntent.intent;
        // await stepContext.context.sendActivity(`${ JSON.stringify(result.entities) }.`);
        // await stepContext.context.sendActivity(`Banking top intent ${ intent }.`);
        // await stepContext.context.sendActivity(`Banking intents detected:  ${ result.intents.map((intentObj) => intentObj.intent).join('\n\n') }.`);

        // if (result.entities.length > 0) {
        //     await stepContext.context.sendActivity(`Banking entities were found in the message: ${ result.entities.map((entityObj) => JSON.stringify(entityObj)).join('\n\n') }.`);//.entity
        // }

        if (intent === 'Make transaction') {
            let number = null;
            result.entities.some((element) => {
                if (element.type === 'builtin.number') {
                    number = element.entity;
                    return true;
                }
                return false;
            });
            return await stepContext.beginDialog('transactionDialog', { number: number });
        } else if (intent === 'View account') {
            await stepContext.context.sendActivity({ attachments: [this.createThumbnailCard()] });
            return await stepContext.next();
        } else if (intent === 'View transactions') {
            let number = null;
            result.entities.some((element) => {
                if (element.type === 'builtin.number') {
                    number = element.entity;
                    return true;
                }
                return false;
            });
            if (number) {
                // let hist = null;
                result.entities.some((element) => {
                    if (element.type === 'historical') {
                        // hist = element.entity;
                        number = null;
                        return true;
                    }
                    return false;
                });
                if (!(number in this.userState.transactions)) {
                    await stepContext.context.sendActivity(`Sorry, could not find a transaction with ID ${ number } in the system.`);
                    return await stepContext.next();
                }
            }
            await stepContext.context.sendActivity({ attachments: [this.createAdaptiveCard(number)] });
            return await stepContext.next();
        } else {
            return await stepContext.next();
        }
    }

    async processBankingQnA(stepContext) {
        console.log('processBankingQnA');

        const results = await this.qnaMaker.getAnswers(stepContext.context);

        if (results.length > 0) {
            await stepContext.context.sendActivity(`${ results[0].answer }`);
        } else {
            await stepContext.context.sendActivity('Sorry, could not find an answer in the Q and A system.');
        }
    }

    //////////////

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the sample "book a flight" interaction with a simple confirmation.
     */
    async surveyStep(stepContext) {
        this.userState.account.timesHelped += 1;
        if ((this.userState.account.timesHelped % 3) === 0) {
            return await stepContext.beginDialog('surveyDialog', this.userState);
        }
        return await stepContext.next();
    }

    async finalStep(stepContext) {
        // If the child dialog ("bookingDialog") was cancelled or the user failed to confirm, the Result here will be null.
        // if (stepContext.result) {
        //     const result = stepContext.result;
        //     // Now we have all the booking details.

        //     // This is where calls to the booking AOU service or database would go.

        //     // If the call to the booking service was successful tell the user.
        //     // const timeProperty = new TimexProperty(result.travelDate);
        //     // const travelDateMsg = timeProperty.toNaturalLanguage(new Date(Date.now()));
        //     // const msg = `I have you booked to ${ result.destination } from ${ result.origin } on ${ travelDateMsg }.`;
        //     const msg = `result: ${ result.number } `;
        //     await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
        // }

        // Restart the main dialog with a different message the second time around
        if ((this.userState.account.transactionsMade === 3) && (!this.userState.account.recommended )) {
            await stepContext.context.sendActivity("It appears you're making a lot of transactions. Check out our Golden accounts to benefit from premium transactions.");
            this.userState.account.recommended = true;
        }
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }

    createAdaptiveCard(number) {
        const adaptiveCard = {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.0',
            type: 'AdaptiveCard',
            // speak: 'Your flight is confirmed for you and 3 other passengers from San Francisco to Amsterdam on Friday, October 10 8:30 AM',
            body: [
                {
                    type: 'TextBlock',
                    text: 'User: John Doe',
                    weight: 'bolder',
                    isSubtle: false
                },
                {
                    type: 'TextBlock',
                    text: 'Transactions:',
                    weight: 'bolder',
                    spacing: 'medium'
                }
            ]
        };

        if (number) {
            this.buildAdaptiveCard(adaptiveCard, number, this.userState.transactions[number]);
        } else {
            Object.keys(this.userState.transactions).forEach(key => {
                this.buildAdaptiveCard(adaptiveCard, key, this.userState.transactions[key]);
            });
        }

        return CardFactory.adaptiveCard(adaptiveCard);
    }

    buildAdaptiveCard(adaptiveCard, key, details) {
        adaptiveCard.body.push(
            {
                type: 'TextBlock',
                text: details.time, //moment().format('dddd, MMMM Do YYYY'), //'Fri, October 10 8:30 AM',
                weight: 'bolder',
                spacing: 'none'
            },
            {
                type: 'ColumnSet',
                spacing: 'medium',
                separator: true,
                columns: [
                    {
                        type: 'Column',
                        width: '1',
                        items: [
                            {
                                type: 'TextBlock',
                                text: `ID: ${ key }`,
                                size: 'medium',
                                isSubtle: true
                            },
                            {
                                type: 'TextBlock',
                                text: `Amount: $${ details.amount }`,
                                size: 'medium',
                                isSubtle: true,
                                spacing: 'none'
                            }
                        ]
                    },
                    {
                        type: 'Column',
                        width: 'auto',
                        items: [
                            {
                                type: 'Image',
                                url: 'https://www.kindpng.com/picc/b/249/2494866.png',
                                size: 'small',
                                spacing: 'none'
                            }
                        ]
                    },
                    {
                        type: 'Column',
                        width: 1,
                        items: [
                            {
                                type: 'TextBlock',
                                horizontalAlignment: 'right',
                                text: `${ details.status }`,
                                size: 'medium',
                                weight: 'bolder'
                            }
                        ]
                    }
                ]
            }
        );
        // return adaptiveCard;
    }

    createThumbnailCard() {
        return CardFactory.thumbnailCard(
            `${ this.userState.account.username }`, // 'BotFramework Thumbnail Card',
            [{ url: 'https://media-exp1.licdn.com/dms/image/C4D0BAQFQ3ei9-Zhx2w/company-logo_200_200/0?e=2159024400&v=beta&t=qVvTFdk3-ZUuqfi__3W0mYLhuAU2SKOVWpCUwmZ36Wo' }],
            [{
                type: 'openUrl',
                title: 'Log In',
                value: 'audionline.bankaudi.com.lb'
                // https://docs.microsoft.com/en-us/azure/bot-service/'
            }],
            {
                subtitle: 'My account',
                text: `Amount in account: ${ this.userState.account.amount }`
            }
        );
    }

    async sendSuggestedActions(stepContext) {
        const cardActions = [
            {
                type: ActionTypes.PostBack,
                title: 'Make a transaction',
                value: 'Make a transaction'
                // image: 'https://via.placeholder.com/20/FF0000?text=R',
                // imageAltText: 'R'
            },
            {
                type: ActionTypes.PostBack,
                title: 'View transactions',
                value: 'View transactions'
                // image: 'https://via.placeholder.com/20/FFFF00?text=Y',
                // imageAltText: 'Y'
            },
            {
                type: ActionTypes.PostBack,
                title: 'View account',
                value: 'View account'
                // image: 'https://via.placeholder.com/20/0000FF?text=B',
                // imageAltText: 'B'
            }
        ];
        let messagetxt = stepContext.options.restartMsg ? stepContext.options.restartMsg : 'How can I help you today?\nYou can check your account and previous transactions, make a transaction, or ask general questions!';
        var reply = MessageFactory.suggestedActions(cardActions, messagetxt);
        return reply;
        // await stepContext.context.sendActivity(reply);
    }
}

module.exports.MainDialog = MainDialog;
