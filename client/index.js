require('dotenv').config();
const readline = require('readline/promises') //This imports the built-in Node.js module readline that handles reading input from the terminal. By using the /promises version, you can use await instead of messy callbacks.

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({apiKey : process.env.GEMINI_API_KEY}); //Creates a Gemini AI client  Uses your API key for authentication

const chatHistory =[];

const rl=readline.createInterface({ //readline.createInterface: This initializes the connection.  input: Listens to what you type (process.stdin).  output: Allows the program to write back to the terminal (process.stdout).  async function(): This starts a function that can "pause" execution (using await) while waiting for the user to finish typing their response.
    input : process.stdin,
    output : process.stdout
}); //another way to understand -> Read input from the keyboard  Write output to the terminal  Ask questions and wait for answers

async function chatLoop(){
    const question = await rl.question('You: '); //Prints You: in terminal  Pauses execution  Waits until user types and presses Enter

    chatHistory.push({
        role:"user",
        parts:[    //Gemini expects messages in a specific "parts" format (to allow for text, images, or files).
            {
                text:question,
            }
        ]
    })

    const response=await ai.models.generateContent({ //This line is the “ask Gemini” line
        model:"gemini-2.5-flash",
        contents:chatHistory
    })

    const responseText= response.text 
    
    chatHistory.push({
        role:"model",
        parts:[                                                       /*parts = [
                                                                                    { text: "Look at this" },
                                                                                    { image: ... },
                                                                                    { text: "Is it clear?" }
                                                                                ]*/
            {
                text:responseText,
            }
        ]
    
    })

     console.log(`AI: ${responseText}`)
    
    chatLoop()
}

    chatLoop() //initial question 