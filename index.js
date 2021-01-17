// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required packages
const path = require('path');

// Note: Ensure you have a .env file and include all necessary credentials to access services like LUIS and QnAMaker.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

const restify = require('restify');
const moment = require('moment-timezone');
// Import required bot services.
// Import required services for bot telemetry
const { ApplicationInsightsTelemetryClient, TelemetryInitializerMiddleware } = require('botbuilder-applicationinsights');
const { TelemetryLoggerMiddleware } = require('botbuilder-core');
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter, ConversationState, InputHints, MemoryStorage, NullTelemetryClient, UserState } = require('botbuilder');

// const { DispatchBot } = require('./bots/dispatchBot');

const { BankingRecognizer } = require('./dialogs/bankingRecognizer');

// This bot's main dialog.
const { DialogAndWelcomeBot } = require('./bots/dialogAndWelcomeBot');
const { MainDialog } = require('./dialogs/mainDialog');

// the bot's other dialogs
const { TransactionDialog } = require('./dialogs/transactionDialog')
const { SurveyDialog } = require('./dialogs/surveyDialog')
// const { BookingDialog } = require('./dialogs/bookingDialog');
// const BOOKING_DIALOG = 'bookingDialog';
const TRANSACTION_DIALOG = 'transactionDialog';
const SURVEY_DIALOG = 'surveyDialog';

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights. See https://aka.ms/bottelemetry for telemetry
    //       configuration instructions.
    console.error(`\n [onTurnError] unhandled error: ${ error }`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${ error }`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    let onTurnErrorMessage = 'The bot encountered an error or bug.';
    await context.sendActivity(onTurnErrorMessage, onTurnErrorMessage, InputHints.ExpectingInput);
    onTurnErrorMessage = 'To continue to run this bot, please fix the bot source code.';
    await context.sendActivity(onTurnErrorMessage, onTurnErrorMessage, InputHints.ExpectingInput);
    // Clear out state
    await conversationState.delete(context);
};

// Add telemetry middleware to the adapter middleware pipeline
var telemetryClient = getTelemetryClient(process.env.InstrumentationKey);
var telemetryLoggerMiddleware = new TelemetryLoggerMiddleware(telemetryClient);
var initializerMiddleware = new TelemetryInitializerMiddleware(telemetryLoggerMiddleware);
adapter.use(initializerMiddleware);

// For local development, in-memory storage is used.
// CAUTION: The Memory Storage used here is for local bot debugging only. When the bot
// is restarted, anything stored in memory will be gone.
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// Create the main dialog.
const luisConfig = {
    applicationId: process.env.LuisAppId,
    endpointKey: process.env.LuisAPIKey,
    endpoint: `https://${ process.env.LuisAPIHostName }.api.cognitive.microsoft.com`
};
userState.account = { username: 'John Doe', amount: 500, timesHelped: 0, transactionsMade: 0, recommended: false };
// userState.transactions = [
//     { ID: 0, amount: 25, status: 'done', time: moment().subtract(7, 'days').format('MMMM D, YYYY') },
//     { ID: 1, amount: 60, status: 'done', time: moment().subtract(2, 'days').format('MMMM D, YYYY') }
// ];

userState.transactions = {
    0: { amount: 25, status: 'Done', time: moment().subtract(7, 'days').format('MMMM D, YYYY') },
    1: { amount: 60, status: 'Done', time: moment().subtract(2, 'days').format('MMMM D, YYYY') }
};

// If configured, pass in the BankingRecognizer.  (Defining it externally allows it to be mocked for tests)
const luisRecognizer = new BankingRecognizer(luisConfig, telemetryClient);
const surveyDialog = new SurveyDialog(SURVEY_DIALOG, userState);
const transactionDialog = new TransactionDialog(TRANSACTION_DIALOG, userState);
const dialog = new MainDialog(luisRecognizer, transactionDialog, surveyDialog, userState);
const bot = new DialogAndWelcomeBot(conversationState, userState, dialog);
// const bot = new DispatchBot();
dialog.telemetryClient = telemetryClient;

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log(`\n${ server.name } listening to ${ server.url }`);
    console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
    console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', (req, res) => {
    // Route received a request to adapter for processing
    adapter.processActivity(req, res, async (turnContext) => {
        // route to bot activity handler.
        await bot.run(turnContext);
    });
});

function getTelemetryClient(instrumentationKey) {
    if (instrumentationKey) {
        return new ApplicationInsightsTelemetryClient(instrumentationKey);
    }
    return new NullTelemetryClient();
}
