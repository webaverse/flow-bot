const http = require('http');
const https = require('https');
const AWS = require('aws-sdk');
/* const flow = {
  sdk: require('@onflow/sdk'),
  types: require('@onflow/types'),
}; */
const Discord = require('discord.js');
const blockchain = require('./blockchain.js');
const fetch = require('node-fetch');
const wordList = require('./wordlist.json');
const config = require('./config.json');
const flowConstants = require('./flow-constants.js');

const {accessKeyId, secretAccessKey, /*githubUsername, githubApiKey,*/ githubPagesDomain, githubClientId, githubClientSecret, stripeClientId, stripeClientSecret} = config;
const awsConfig = new AWS.Config({
  credentials: new AWS.Credentials({
    accessKeyId,
    secretAccessKey,
  }),
  region: 'us-west-1',
});
const ddb = new AWS.DynamoDB(awsConfig);
const discordApiToken = 'NzU4OTU2NzAyNjY5MjA5NjEx.X22fgg.UxsWovr_n4l2sjx3rbZw7f5T-Rs';
const guildId = '433492168825634816';
const channelName = 'token-hax';
const adminUserId = '284377201233887233';
const tableName = 'users';

const _runArray = async (userKeys, array) => {
  const result = Array(array.length);
  for (let i = 0; i < array.length; i++) {
    result[i] = await _runSpec(userKeys, array[i]);
  }
  return result;
};
const _createAccount = async () => {
  const res = await fetch(accountsHost, {
    method: 'POST',
  });
  const j = await res.json();
  return j;
};
const _bakeContract = async (contractKeys, contractSource) => {
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      address: contractKeys.address,
      privateKey: contractKeys.privateKey,
      publicKey: contractKeys.publicKey,
      mnemonic: userKeys.mnemonic,

      limit: 100,
      transaction: `\
        transaction(code: String) {
          prepare(acct: AuthAccount) {
            acct.setCode(code.decodeHex())
          }
        }
      `,
      args: [
        {value: uint8Array2hex(new TextEncoder().encode(contractSource)), type: 'String'},
      ],
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
const _runTransaction = async (userKeys, transaction) => {
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      address: userKeys.address,
      privateKey: userKeys.privateKey,
      publicKey: userKeys.publicKey,
      mnemonic: userKeys.mnemonic,

      limit: 100,
      transaction,
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
const _runScript = async script => {
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      limit: 100,
      script,
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
const _runSpec = async (userKeys, spec) => {
  const {transaction, script, args} = spec;
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      address: userKeys.address,
      privateKey: userKeys.privateKey,
      publicKey: userKeys.publicKey,
      mnemonic: userKeys.mnemonic,

      limit: 100,
      transaction,
      script,
      args,
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};

(async () => {
  const {FungibleToken, NonFungibleToken, ExampleToken, ExampleNFT, ExampleAccount, host} = await flowConstants.load();

  const client = new Discord.Client();

  client.on('ready', async function() {
    console.log(`the client becomes ready to start`);
    console.log(`I am ready! Logged in as ${client.user.tag}!`);
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);

    // console.log('got', client.guilds.cache.get(guildId).members.cache);

    client.on('message', async message => {
      if (!message.author.bot) {
        const _getUser = async (id = message.author.id) => {
          const tokenItem = await ddb.getItem({
            TableName: tableName,
            Key: {
              email: {S: id + '.discord'},
            }
          }).promise();

          let mnemonic = (tokenItem.Item && tokenItem.Item.mnemonic) ? tokenItem.Item.mnemonic.S : null;
          let addr = (tokenItem.Item && tokenItem.Item.addr) ? tokenItem.Item.addr.S : null;
          return {mnemonic, addr};
        };
        const _genKey = async (id = message.author.id) => {
          let mnemonic = blockchain.makeMnemonic();

          const userKeys = await blockchain.genKeys(mnemonic);
          // console.log('generating 1', userKeys);
          let addr = await blockchain.createAccount(userKeys);
          // console.log('generating 2', addr);

          await ddb.putItem({
            TableName: tableName,
            Item: {
              email: {S: id + '.discord'},
              mnemonic: {S: mnemonic},
              addr: {S: addr},
            }
          }).promise();
          return {mnemonic, addr};
        };
        const _ensureBaked = async ({addr, mnemonic}) => {
          const contractSource = await blockchain.getContractSource('isUserAccountBaked.cdc');

          const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
            method: 'POST',
            body: JSON.stringify({
              limit: 100,
              script: contractSource.replace(/ARG0/g, '0x' + addr),
              wait: true,
            }),
          });
          const response = await res.json();
          const isBaked = response.encodedData.value;
          if (!isBaked) {
            const contractSources = await blockchain.getContractSource('bakeUserAccount.json');
            for (const contractSource of contractSources) {
              contractSource.address = addr;
              contractSource.mnemonic = mnemonic;
              contractSource.limit = 100;
              contractSource.wait = true;

              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify(contractSource),
              });
              
              const response = await res.json();
              console.log('baked account result', response);
            }
          }
        };

        if (message.channel.type === 'text' && message.channel.name === channelName) {
          // console.log('got message', message);

          if (/grease/.test(message.content)) {
            message.author.send('i am NOT grease?!!!!');
          }
          const split = message.content.split(/\s+/);
          let match;
          if (split[0] === 'dump' && split.length >= 4) {
            // console.log('got', split[1]);
            const match = split[1].match(/<@!([0-9]+)>/);
            if (match) {
              // console.log('got split 1', match[1]);
              const member = client.guilds.cache.get(guildId).members.cache.get(match[1]);
              // console.log('got split 2', member.user.send('woot'));
            }
          } else if (split[0] === 'balance') {
            let match;
            if (split.length >= 2 && (match = split[1].match(/<@!([0-9]+)>/))) {
              const userId = match[1];
              let {mnemonic, addr} = await _getUser(userId);
              if (!mnemonic) {
                const spec = await _genKey(userId);
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              await _ensureBaked({addr, mnemonic});

              {
                const contractSource = await blockchain.getContractSource('getBalance.cdc');

                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 100,
                    script: contractSource.replace(/ARG0/g, '0x' + addr),
                    wait: true,
                  }),
                });
                const response2 = await res.json();
                const balance = parseFloat(response2.encodedData.value);

                message.channel.send('<@!' + userId + '> is ' + balance + ' grease');
              }
            } else {
              let {mnemonic, addr} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              await _ensureBaked({addr, mnemonic});

              {
                const contractSource = await blockchain.getContractSource('getBalance.cdc');

                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 100,
                    script: contractSource.replace(/ARG0/g, '0x' + addr),
                    wait: true,
                  }),
                });
                const response2 = await res.json();
                const balance = parseFloat(response2.encodedData.value);

                message.channel.send('<@!' + message.author.id + '> is ' + balance + ' grease');
              }
            }
          } else if (split[0] === 'publickey') {
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            const userKeys = await blockchain.genKeys(mnemonic);
            const {publicKey} = userKeys;

            message.channel.send('<@!' + message.author.id + '>\'s public key: ```' + publicKey + '```');
          } else if (split[0] === 'address') {
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }

            message.channel.send('<@!' + message.author.id + '>\'s address: ```' + addr + '```');
          } else if (split[0] === 'flowkey') {
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            const userKeys = await blockchain.genKeys(mnemonic);
            const {flowKey} = userKeys;

            message.channel.send('<@!' + message.author.id + '>\'s flow key: ```' + flowKey + '```');
          } else if (split[0] === 'mint' && split.length >= 2 && !isNaN(parseFloat(split[1])) && message.author.id === adminUserId) {
            const amount = parseFloat(split[1]);

            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            await _ensureBaked({addr, mnemonic});

            {
              const contractSource = await blockchain.getContractSource('mintToken.cdc');
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: config.exampleToken.address,
                  mnemonic: config.exampleToken.mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, '0x' + addr)
                    .replace(/ARG1/g, amount.toFixed(8)),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              if (!response2.transaction.errorMessage) {
                message.channel.send('<@!' + message.author.id + '>: minted ' + amount);
              } else {
                message.channel.send('<@!' + message.author.id + '>: could not mint: ' + response2.transaction.errorMessage);
              }
            }
          } else if (split[0] === 'send' && split.length >=3 && (match = split[1].match(/<@!([0-9]+)>/)) && !isNaN(parseFloat(split[2]))) {
            const userId = match[1];
            const member = message.channel.guild.members.cache.get(userId);
            const user = member ? member.user : null;
            const amount = parseFloat(split[2]);
            if (user) {
              let {mnemonic, addr} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              await _ensureBaked({addr, mnemonic});
              // console.log('baked 1', user.id);

              let {mnemonic: mnemonic2, addr: addr2} = await _getUser(user.id);
              if (!mnemonic2) {
                const spec = await _genKey(userId);
                mnemonic2 = spec.mnemonic;
                addr2 = spec.addr;
              }
              await _ensureBaked({addr: addr2, mnemonic: mnemonic2});
              // console.log('baked 2', user.id);

              const contractSource = await blockchain.getContractSource('transferToken.cdc');
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: addr,
                  mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, amount.toFixed(8))
                    .replace(/ARG1/g, '0x' + addr2),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              if (!response2.transaction.errorMessage) {
                message.channel.send('<@!' + message.author.id + '>: greased ' + amount + ' to <@!' + userId + '>');
              } else {
                message.channel.send('<@!' + message.author.id + '>: could not send: ' + response2.transaction.errorMessage);
              }
            } else {
              message.channcel.send('unknown user');
            }

            /* let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            await _ensureBaked({addr, mnemonic});

            {
              const contractSource = await blockchain.getContractSource('mintToken.cdc');
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: config.exampleToken.address,
                  mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, '0x' + addr)
                    .replace(/ARG1/g, amount.toFixed(8)),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              if (!response2.transaction.errorMessage) {
                message.channel.send('<@!' + message.author.id + '>: minted ' + amount);
              } else {
                message.channel.send('<@!' + message.author.id + '>: could not mint: ' + response2.transaction.errorMessage);
              }
            } */
          } else if (split[0] === 'inventory') {
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            await _ensureBaked({addr, mnemonic});

            const contractSource = await blockchain.getContractSource('getHashes.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                address: config.exampleNft.address,
                mnemonic: config.exampleNft.mnemonic,

                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, '0x' + addr),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const hashes = response2.encodedData.value.map(({value: hash}) => hash);

            // console.log('got response', response2);

            message.channel.send('<@!' + message.author.id + '>:\n```' + hashes.map(hash => 'https://storage.exokit.org/' + hash).join('\n') + '```');
          } else {
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            await _ensureBaked({addr, mnemonic});

            for (const [key, attachment] of message.attachments) {
              const {name, proxyURL} = attachment;

              await new Promise((accept, reject) => {
                const proxyReq = https.request(proxyURL, proxyRes => {
                  const req = https.request('https://storage.exokit.org/', {
                    method: 'POST',
                  }, res => {
                    const bs = [];
                    res.on('data', d => {
                      bs.push(d);
                    });
                    res.on('end', async () => {
                      const b = Buffer.concat(bs);
                      const s = b.toString('utf8');
                      const j = JSON.parse(s);
                      const {hash} = j;

                      const contractSource = await blockchain.getContractSource('mintNft.cdc');

                      const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                        method: 'POST',
                        body: JSON.stringify({
                          address: config.exampleNft.address,
                          mnemonic: config.exampleNft.mnemonic,

                          limit: 100,
                          transaction: contractSource
                            .replace(/ARG0/g, hash)
                            .replace(/ARG1/g, '0x' + addr),
                          wait: true,
                        }),
                      });
                      const response2 = await res.json();

                      if (!response2.transaction.errorMessage) {
                        message.channel.send('<@!' + message.author.id + '>: minted ' + hash + ' (https://storage.exokit.org/' + hash + ')');
                      } else {
                        message.channel.send('<@!' + message.author.id + '>: could not mint: ' + response2.transaction.errorMessage);
                      }

                      accept();
                    });
                    res.on('error', reject);
                  });
                  req.on('error', reject);
                  proxyRes.pipe(req);
                });
                proxyReq.on('error', reject);
                proxyReq.end();
              });
            }
          }
        } else if (message.channel.type === 'dm') {
          let {mnemonic, addr} = await _getUser();

          const split = message.content.split(/\s+/);
          if (split[0] === 'key') {
            if (split.length >= 31) {
              const key = split.splice(1, 31);
              if (key.every(word => wordList.includes(word))) {
                const mnemonic = key.slice(0, 24).join(' ');
                const addr = blockchain.wordListToHex(key.slice(24).join(' '));

                await ddb.putItem({
                  TableName: tableName,
                  Item: {
                    email: {S: id + '.discord'},
                    mnemonic: {S: mnemonic},
                    addr: {S: addr},
                  }
                }).promise();
                message.author.send('set key to ```' + JSON.stringify({
                  mnemonic,
                  addr,
                }) + '```');
              } else {
                message.author.send('invalid key');
              }
            } else {
              if (!mnemonic || split[1] === 'reset') {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              await _ensureBaked({addr, mnemonic});

              const key = mnemonic + ' ' + blockchain.hexToWordList(addr);
              message.author.send('Key: ```' + key + '```');
            }
          }
        }
      }
    });
  });

  client.login(discordApiToken);
})();