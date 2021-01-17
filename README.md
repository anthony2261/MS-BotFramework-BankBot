# MS-BotFramework-BankBot
Bot built using MS BotFramework for a Bank. Uses LUIS intent classifier, QnA Maker to answer FAQ, and TextAnalytics for sentiment analysis.

# Prerequisites
A ".env" file containing:

MicrosoftAppId="" (Optional) <br>
MicrosoftAppPassword="" (Optional)

QnAKnowledgebaseId="" <br>
QnAEndpointKey="" <br>
QnAEndpointHostName="" <br>

LuisAppId=<br>
LuisAPIKey=<br>
LuisAPIHostName=<br>

InstrumentationKey=

COG_Endpoint=""<br>
COG_SUB_KEY=""

# To Run
``npm install``<br>
``npm run``<br>
And open http://localhost:3978/api/messages in your emulator.

### Please refer to MS_BotFramework_Documentation.pdf for a detailed documentation.