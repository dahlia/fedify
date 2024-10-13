Fedify–Express integration example
==================================

This is a simple example of how to integrate Fedify into an [Express]
application.

[Express]: https://expressjs.com/


Running the example
-------------------

 1. Clone the repository:

    ~~~~ sh
    git clone https://github.com/dahlia/fedify.git
    cd fedify/examples/express
    ~~~~

 2. Install dependencies:

    ~~~~ sh
    # optional
    nvm use
    npm i
    ~~~~

 3. Start the server:

    ~~~~ sh
    npm start & npx @fedify/cli tunnel 8000
    ~~~~

 4. Open your browser tunneled URL and start interacting with the app.
    You can see your handle such as
    `@demo@6c10b40c63d9e1ce7da55667ef0ef8b4.serveo.net`.

 5. Access <https://activitypub.academy/> and search your handle and follow.

 6. You can see following list like:

    ~~~~
    This account has the below 1 followers:
    https://activitypub.academy/users/beboes_bedoshs
    ~~~~