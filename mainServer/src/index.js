const { GraphQLServer } = require('graphql-yoga')
const { Prisma } = require('prisma-binding')
const { HttpLink } = require('apollo-link-http')
const fetch = require('node-fetch')
const { introspectSchema, makeRemoteExecutableSchema, makeExecutableSchema } = require('graphql-tools')
const { importSchema } = require(`graphql-import`)
const { Binding } = require(`graphql-binding`)
const DataLoader = require(`dataloader`)


const resolvers = {
  Query: {
    feed(parent, args, ctx, info) {
      return ctx.db.query.posts({ where: { isPublished: true } }, info)
    },
    drafts: async(parent, args, ctx, info) => {
      return ctx.db.query.posts({ where: { isPublished: false } }, info)
    },
    post(parent, { id }, ctx, info) {
      return ctx.db.query.post({ where: { id } }, info)
    },
  },
  Mutation: {
    createDraft(parent, { title, text }, ctx, info) {
      return ctx.db.mutation.createPost(
        {
          data: {
            title,
            text,
            isPublished: false,
          },
        },
        info,
      )
    },
    deletePost(parent, { id }, ctx, info) {
      return ctx.db.mutation.deletePost({ where: { id } }, info)
    },
    publish(parent, { id }, ctx, info) {
      return ctx.db.mutation.updatePost(
        {
          where: { id },
          data: { isPublished: true },
        },
        info,
      )
    },
  },
  Post: {
    images: {
      fragment: `fragment ImageId on Post { id }`,
      resolve: async (parent, source, { postImageLoader }, info) => {
        return postImageLoader.load({ id: parent.id, info })
      }
    }
  }
}


const makeImageServiceLink = new HttpLink({
  uri: `http://localhost:4001`,
  fetch
})

introspectSchema(makeImageServiceLink)
  .then(remoteSchema => {

    const imageSchema = makeRemoteExecutableSchema({
      schema: remoteSchema,
      link: makeImageServiceLink
    })

    const imageServer = new Binding({ schema: imageSchema })

    const schema = makeExecutableSchema({
      typeDefs: [ importSchema(`./src/schema.graphql`), `extend type Post { images: [Image!]! }` ],
      resolvers
    })

    const postImageLoader = new DataLoader(async idsAndInfo => {
      //
       //  Questions:
      //   1.  How to pass `info` into Dataloader
      //   2.  How to make `postId` available to map back the results
      const ids = idsAndInfo.map(({ id }) => id)
      const images = await imageServer.query.images({ where: { postId_in: ids }}, {}, idsAndInfo[0].info)
      return ids.map(id => images.filter(({ postId }) => postId === id))
    })

    const server = new GraphQLServer({
      schema,
      context: req => ({
        ...req,
        postImageLoader,
        imageServer,
        db: new Prisma({
          typeDefs: 'src/generated/prisma.graphql',
          endpoint: 'https://us1.prisma.sh/dennis-walsh/mainserver/dev', // the endpoint of the Prisma DB service
          secret: 'mysecret123', // specified in database/prisma.yml
          debug: true, // log all GraphQL queryies & mutations
        }),
      }),
    })

    server.start(() => console.log('Server is running on http://localhost:4000'))
  })
