import express from "express";
import morgan from "morgan";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from 'cors';
import OpenAI from "openai";

const app = express();
dotenv.config();

app.use(morgan("combined"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json())
app.use(cors())

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/extract-keywords", async (req, res) => {
    try {
        const {prompt} = req.body
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                "role": "system",
                "content": "You will be provided with a block of text, and your task is to extract a list of keywords from it."
              },
              {
                "role": "user",
                "content": `${prompt}`
              }
            ],
            temperature: 0.5,
            max_tokens: 64,
            top_p: 1,
          });
          

        return res.status(200).json({
            success: "true",
            data: response.choices[0].message.content
        })
    } catch (error) {
        res.status(400).json({
            success: "false",
            error: error.response ? error.response.data : "There was an issue with the server"
        })
    }
})

const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});