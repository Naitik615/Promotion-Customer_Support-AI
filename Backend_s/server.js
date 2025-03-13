const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
const {OpenAI }= require('openai/index.mjs');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System prompt for AI responses
const SYSTEM_PROMPT_EN = `You are Alex, a friendly and professional sales representative. Follow these guidelines:

1. Communication Style:
   - Be natural and conversational, like a real person
   - Keep responses brief (1-2 sentences)
   - Show enthusiasm but remain professional
   - Listen carefully to customer responses
   - Adapt your tone based on customer interest
-features:
1. *AI-Powered Camera*: 48MP high-resolution camera with AI-supported features for capturing stunning photos.
2. *Face Unlock*: Advanced facial recognition technology that unlocks the phone with just a glance.
3. *Long-Lasting Battery*: 5000mAh battery that provides all-day usage without worry.
4. *Smart Assistant*: AI-powered voice assistant that helps you multitask hands-free.
5. *Fast Processor*: Qualcomm Snapdragon processor for high performance and seamless multitasking.
6. *Super-Fast Charging*: 30W fast charging support, allowing you to charge quickly and get back to using your phone.
7. *Intelligent Display*: Advanced AMOLED display with vibrant colors and brightness, even under direct sunlight.


2. Conversation Flow:
   Initial Greeting:
   - Just a simple "Hello sir/ma'am, is this a convenient time to talk?"
   - Wait for their response

   If they say "No" or seem busy:
   - Be understanding
   - Politely end the call
   - Ask when would be a better time to call back

   If they say "Yes":
   - Briefly mention: "I'm calling about our new AI smartphone that's revolutionizing the market"
   - Let them guide the conversation with questions

3. When Customer Shows Interest:
   - Focus on benefits they specifically ask about
   - If they want to order:
     * Thank them warmly
     * Provide their order ID
     * Mention: "Our payment team will contact you shortly"
     * End call professionally

4. Key Points:
   - Never be pushy
   - Listen more than you speak
   - Address their concerns directly
   - Keep the conversation flowing naturally

Remember: You're having a real conversation, not reading a script.`;

const SYSTEM_PROMPT_HI = `आप अलेक्स हैं, एक मित्रवत और पेशेवर सेल्स प्रतिनिधि। इन दिशानिर्देशों का पालन करें:

1. संवाद शैली:
   - स्वाभाविक और वार्तालाप जैसा रहें
   - संक्षिप्त जवाब दें (1-2 वाक्य)
   - उत्साह दिखाएं पर पेशेवर बने रहें
   - ग्राहक की प्रतिक्रिया ध्यान से सुनें
   - ग्राहक की रुचि के अनुसार अपना लहजा बदलें

2. वार्तालाप प्रवाह:
   प्रारंभिक अभिवादन:
   - बस एक साधारण "नमस्ते सर/मैडम, क्या अभी बात करने का उचित समय है?"
   - उनकी प्रतिक्रिया का इंतजार करें

   अगर वे "नहीं" कहें या व्यस्त लगें:
   - समझदारी दिखाएं
   - विनम्रता से कॉल समाप्त करें
   - पूछें कि कब वापस कॉल करना बेहतर रहेगा

   अगर वे "हां" कहें:
   - संक्षेप में बताएं: "मैं हमारे नए AI स्मार्टफोन के बारे में बात कर रहा/रही हूं जो बाजार में क्रांति ला रहा है"
   - उनके सवालों से वार्तालाप को आगे बढ़ने दें

3. जब ग्राहक रुचि दिखाए:
   - उन्हीं फायदों पर ध्यान दें जिनके बारे में वे पूछें
   - अगर वे ऑर्डर करना चाहें:
     * हार्दिक धन्यवाद दें
     * उनका ऑर्डर ID प्रदान करें
     * बताएं: "हमारी पेमेंट टीम जल्द ही आपसे संपर्क करेगी"
     * पेशेवर तरीके से कॉल समाप्त करें

4. महत्वपूर्ण बिंदु:
   - कभी भी दबाव न डालें
   - बोलने से ज्यादा सुनें
   - उनकी चिंताओं का सीधा समाधान करें
   - वार्तालाप को स्वाभाविक रूप से बहने दें

याद रखें: आप एक वास्तविक वार्तालाप कर रहे हैं, स्क्रिप्ट नहीं पढ़ रहे।`;

app.use(cors());
app.use(express.json());

let orderCounter = 1000; // Starting order ID

const generateOrderId = () => {
    return `ORD${orderCounter++}`;
};

const INITIAL_GREETING = {
    en: "Hello {title}, is this a convenient time to talk?",
    hi: "नमस्ते {title}, क्या अभी बात करने का उचित समय है?"
};

// Add these after other initialization code
// Create data directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize files if they don't exist
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const CALL_LOGS_FILE = path.join(__dirname, 'data', 'call_logs.json');
[ORDERS_FILE, CALL_LOGS_FILE].forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '[]', 'utf8');
    }
});

// Add these helper functions before the app.post routes

function saveOrder(orderData) {
    let orders = [];
    try {
        const fileContent = fs.readFileSync(ORDERS_FILE, 'utf8');
        orders = fileContent ? JSON.parse(fileContent) : [];
    } catch (error) {
        console.error('Error reading orders:', error);
        orders = [];
    }
    orders.push(orderData);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function saveCallLog(logData) {
    let logs = [];
    try {
        const fileContent = fs.readFileSync(CALL_LOGS_FILE, 'utf8');
        logs = fileContent ? JSON.parse(fileContent) : [];
    } catch (error) {
        console.error('Error reading call logs:', error);
        logs = [];
    }
    logs.push(logData);
    fs.writeFileSync(CALL_LOGS_FILE, JSON.stringify(logs, null, 2));
}

// Main endpoint for text processing
app.post("/send-text", async (req, res) => {
    const { text, language, name, gender, mobile, callEndType } = req.body;
    
    // Handle call end logging
    if (callEndType) {
        saveCallLog({
            timestamp: new Date().toISOString(),
            name,
            mobile,
            gender,
            language,
            callEndType,
            callDuration: req.body.callDuration || 'N/A'
        });
        return res.json({ success: true });
    }

    try {
        let aiResponse;
        let isOrdering = false; // Define isOrdering here
        
        // Handle initial greeting
        if (text === 'initial_greeting') {
            const title = gender === 'male' ? 
                (language === 'hi' ? 'सर' : 'sir') : 
                (language === 'hi' ? 'मैडम' : 'ma\'am');
            aiResponse = INITIAL_GREETING[language || 'en'].replace('{title}', title);
        } else {
            // Regular conversation
            const messages = [
                { 
                    role: 'system', 
                    content: language === 'hi' ? SYSTEM_PROMPT_HI : SYSTEM_PROMPT_EN 
                },
                { 
                    role: 'user', 
                    content: `Customer Name: ${name}\nGender: ${gender}\nMessage: ${text}` 
                }
            ];

            // Check for order intent
            const orderKeywords = ['book', 'order', 'buy', 'purchase', 'want', 'take', 'interested'];
            isOrdering = orderKeywords.some(keyword => 
                text.toLowerCase().includes(keyword)
            );

            if (isOrdering) {
                const orderId = generateOrderId();
                
                // Save order details
                saveOrder({
                    orderId,
                    timestamp: new Date().toISOString(),
                    customerName: name,
                    customerMobile: mobile,
                    gender,
                    language,
                    orderText: text
                });

                messages.push({
                    role: 'system',
                    content: `Customer wants to order. Generate a warm response that: 1) Thanks them for their order, 2) Clearly states their Order ID is ${orderId}, 3) Mentions that the payment team will contact them shortly, and 4) Ends with a polite goodbye. Keep it natural but ensure all information is included.`
                });
            }

            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: messages,
                temperature: 0.8,
                max_tokens: 150
            });

            aiResponse = completion.choices[0].message.content;
        }

        // Generate speech
        const audioResponse = await axios({
            method: 'post',
            url: 'https://api.openai.com/v1/audio/speech',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                model: 'tts-1',
                input: aiResponse,
                voice: language === 'hi' ? 'shimmer' : 'echo',
                speed: 1.0
            },
            responseType: 'arraybuffer'
        });

        const audioBase64 = Buffer.from(audioResponse.data).toString('base64');

        res.json({
            aiResponse,
            audio: audioBase64,
            shouldEndCall: isOrdering // New flag to indicate if call should end
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ 
            error: "Error processing request",
            details: error.message 
        });
    }
});

app.get("/orders", (req, res) => {
    try {
        const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
        res.json(orders);
    } catch (error) {
        console.error("Error reading orders:", error);
        res.status(500).json({ error: "Error reading orders" });
    }
});

app.get("/calls", (req, res) => {
    try {
        const calls = JSON.parse(fs.readFileSync(CALL_LOGS_FILE, 'utf8'));
        res.json(calls);
    } catch (error) {
        console.error("Error reading call logs:", error);
        res.status(500).json({ error: "Error reading call logs" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Ready to process requests");
});