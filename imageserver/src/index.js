const { GraphQLServer } = require('graphql-yoga')
const { Prisma, forwardTo } = require('prisma-binding')

const resolvers = {
  Query: {
   images: forwardTo('db')
  }
}

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      typeDefs: 'src/generated/prisma.graphql',
      endpoint: 'https://us1.prisma.sh/dennis-walsh/imageserver/dev', // the endpoint of the Prisma DB service
      secret: 'mysecret123', // specified in database/prisma.yml
      debug: true, // log all GraphQL queryies & mutations
    }),
  }),
})

server.start({ port: 4001}, () => console.log('Server is running on http://localhost:4001'))
