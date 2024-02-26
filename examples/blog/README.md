<!-- deno-fmt-ignore-file -->

Federated single-user blog
==========================

This project is an example of a federated single-user blog.  It is built on top
of the following technologies:

 -  [Deno] for runtime
 -  [Deno KV] for database
 -  [Fresh] for web framework
 -  Fedify for federation

[Deno]: https://deno.com/
[Deno KV]: https://deno.com/kv
[Fresh]: https://fresh.deno.dev/


Usage
-----

Start the project with the following command:

~~~~ sh
deno task start
~~~~

The above command will start the server on port 8000.  You can access the blog
at <http://localhost:8000/>, but in order to federate your server with other
servers in the fediverse, you need to expose your server with a public domain
name in HTTPS.  There are plenty of ways to do this, but one of the easiest
ways for development is to use [ngrok]:[^1]

~~~~ sh
ngrok http 8000
~~~~

At first, you need to set up your blog profile by visiting the root URL of your
blog:

![The initial setting up form.](images/setup.png)

After that, you can start federating your blog with other servers through your
fediverse handle:

![Where the fediverse handle shows up.](images/handle.png)

[^1]: To grasp the concept of ngrok and how to use it, please refer
      the [official quick start guide][1].

[ngrok]: https://ngrok.com/
[1]: https://ngrok.com/docs/getting-started/
