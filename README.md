# D&D Campaign App

This is a web application for managing and enhancing Dungeons & Dragons campaigns. It uses AI to help Dungeon Masters generate content and manage their campaigns.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your machine.

### Installing

1. Clone the repository:
   ```bash
   git clone https://github.com/muicmateo/dnd-campaign-app.git
   ```
2. Navigate to the project directory:
    ```bash
    cd dnd-campaign-app
    ```
3. Install the dependencies:
    ```bash
    npm install
    ```
4. Create a `.env` file in the root of the project and add your API key:
    ```
    API_KEY=your_api_key_here
    ```

## Usage

To start the application, run the following command:

```bash
node app.js
```

Then, open your browser and go to `http://localhost:3000`.

## Dependencies

*   [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)
*   [axios](https://www.npmjs.com/package/axios)
*   [dotenv](https://www.npmjs.com/package/dotenv)
*   [express](https://www.npmjs.com/package/express)
*   [marked](https://www.npmjs.com/package/marked)
