# Socket To Me

Socket To Me is WebSocket benchmarking/load generator. There are a lot of benchmarking
tools for HTTP servers. You've got ab, siege, wrk and more. But all these tools
only work with plain ol HTTP and have no support for WebSockets - even if they did
they wouldn't be suitable, as they would be testing short running HTTP requests
instead of long running HTTP requests with a lot of messaging traffic.

Socket To Me is a forked modification of Thor https://github.com/observing/thor

### Dependencies

Socket To Me requires Node.js to be installed on your system. If you don't have Node.js
installed you can download it from http://nodejs.org or build it from the github
source repository: http://github.com/joyent/node.

Once you have Node.js installed, you can use the bundled package manager `npm` to
install this module:

```
npm install -g socket-to-me
```

The `-g` command flag tells `npm` to install the module globally on your system.

### Usage

```
sockme [options] <urls>
```

Socket To Me can hit multiple URL's at once; this is useful if you are testing your
reverse proxies, load balancers or just simply multiple applications. The url
that you supply to `sockme` should be written in a WebSocket compatible format
using the `ws` or `wss` protocols:

```
sockme --amount 5000 ws://localhost:8080 wss://localhost:8081
```

The snippet above will open up `5000` connections against the regular
`ws://localhost:8080` and also `5000` connections against the *secured*
`wss://localhost:8081` server, so a total of `10000` connections will be made.

One thing to keep in mind is you probably need to bump the amount of file
descriptors on your local machine if you start testing WebSockets. Set the
`ulimit -n` on machine as high as possible. If you do not know how to do this,
Google it.

#### Options

```
  Usage: sockme [options] ws://localhost

  Options:

    -h, --help                      output usage information
    -D, --duration <duration>       duration in seconds to run
    -p, --payloads <payloads>        comma separated min and max payloads in bytes
    -A, --amount <connections>      the amount of persistent connections to generate
    -C, --concurrent <connections>  how many connections to bring up at a time per url
    -I, --interval <interval>       the interval over which to bring connections up
    -F, --frequency <frequency>     comma separated max and min frequency between messages in ms
    -B, --buffer <size>             size of the messages that are send
    -W, --workers <cpus>            workers to be spawned defaults to num cpus
    -G, --generator <file>          custom message generators
    -P, --protocol <protocol>       name of websocket protocol
    -U, --user <librato-user>       email for librato account
    -T, --token <librato-token>     token for librato account
    -V, --version                   output the version number
```

Some small notes about the options:

- `--protocol` is the string protocol passed to the websocket constructor
- `--payloads` will generate random payloads in the given range
- `--buffer` should be size of the message in bytes if specified it takes precedent over `--payloads`
- `--workers` as Node.js is single threaded this sets the amount of sub
  processes to handle all the heavy lifting.
- `--user, --token` the librato plugin will send stats a librato account
   this can be useful if you're running multiple socket-to-me tests at 
   the same time using something like Docker and would like to see stats
   the user and token can be set as environment variablest to `LIBRATO_USER`
   and `LIBRATO_TOKEN`.

### Custom messages

Some WebSocket servers have their own custom messaging protocol. In order to
work with those servers we introduced a concept called `generators` a generator
is a small JavaScript file that can output messages. It uses
a really simple generator by default. 

Checkout https://github.com/nphyatt/socket-to-me/blob/master/generator.js for an
example of a generator.

```
sockme --amount 1000 --generator <file.js> ws://localhost:8080
```

### Example

```
sockme --amount 10 --duration 5 ws://localhost:8080
```

This will hit the WebSocket server that runs on localhost:8080 with 1000
connections and sends 100 messages over each established connection. Once `sockme`
is done with socking your connections it will generate a detailed report:

```
Socket To Me!                                                  version: 1.0.0

Yo here's the deal,
I'm gonna...
- Run 4 workers.
- Create all the connections at once
- Socket To 10 websockets on 1 connection for 5 seconds.

Hope you're happy with yourself.

Connecting to ws://localhost:8080


Time ran             5.026 seconds
Connected            10
Disconnected         0
Errors               0

                Total Data      Avg. Msg        Max. Msg        Min. Msg        # Msgs
TX Stats:       34.6kB          372.95B         1.07kB          101B            95
RX Stats:       40.65kB         297.29B         1.08kB          0B              140

```

### License

MIT
