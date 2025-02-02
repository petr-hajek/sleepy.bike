import {
  dct,
  foaf,
  ldp,
  schema_https,
  solid,
  space,
  vcard,
} from 'rdf-namespaces'
import { Person } from './commands'
import { UserConfig } from './css-authentication'

export type CommunityConfig = { community: string; group: string }
export type SetupConfig = {
  publicTypeIndex: string
  privateTypeIndex: string
  hospexContainer: string
  hospexProfile: string
  inbox: string
}

export const setupCommunity = ({
  community: communityUri,
}: {
  community: string
}) => {
  const url = new URL(communityUri)
  const username = url.pathname.split('/')[1]
  url.hash = ''
  const communityDoc = url.toString()
  url.pathname += '.acl'
  const communityAcl = url.toString()
  url.pathname = `/${username}/`
  url.pathname += 'group'
  url.hash = 'us'
  const groupUri = url.toString()
  url.hash = ''
  const groupDoc = url.toString()
  url.pathname += '.acl'
  const groupAcl = url.toString()
  // currently, we can create account only once
  // because we have no way of deleting accounts before new tests
  cy.createAccountIfNotExist({
    username,
    password: 'correcthorsebatterystaple',
  }).as('communityUser')
  cy.get<UserConfig>('@communityUser').then(user => {
    cy.authenticatedRequest(user, {
      url: groupAcl,
      method: 'DELETE',
      failOnStatusCode: false,
    })
    cy.authenticatedRequest(user, {
      url: communityAcl,
      method: 'DELETE',
      failOnStatusCode: false,
    })
    cy.authenticatedRequest(user, {
      url: groupDoc,
      method: 'DELETE',
      failOnStatusCode: false,
    })
    cy.authenticatedRequest(user, {
      url: communityDoc,
      method: 'DELETE',
      failOnStatusCode: false,
    })
    cy.authenticatedRequest(user, {
      url: communityDoc,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix hospex: <http://w3id.org/hospex/ns#>.
      @prefix sioc: <http://rdfs.org/sioc/ns#>.
      <${communityUri}> a hospex:Community, sioc:Community;
        sioc:name "Test Community"@en;
        sioc:about "Development community for sleepy-bike-solid"@en;
        sioc:has_usergroup <${groupUri}>.`,
    })
    cy.authenticatedRequest(user, {
      url: groupDoc,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix sioc: <http://rdfs.org/sioc/ns#>.
      @prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
      <${groupUri}> a sioc:Usergroup, vcard:Group;
      sioc:usergroup_of <${communityUri}>.`,
    })
    cy.authenticatedRequest(user, {
      url: communityAcl,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.
      @prefix foaf: <http://xmlns.com/foaf/0.1/>.
      <#Control> a acl:Authorization;
        acl:agent <${user.webId}>;
        acl:accessTo <${communityDoc}>;
        acl:mode acl:Read, acl:Write, acl:Control.
      <#Read> a acl:Authorization;
        acl:accessTo <${communityDoc}>;
        acl:mode acl:Read;
        acl:agentClass foaf:Agent.`,
    })
    cy.authenticatedRequest(user, {
      url: groupAcl,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.
      @prefix foaf: <http://xmlns.com/foaf/0.1/>.
      <#Control> a acl:Authorization;
        acl:agent <${user.webId}>;
        acl:accessTo <${groupDoc}>;
        acl:mode acl:Read, acl:Write, acl:Control.
      <#Read> a acl:Authorization;
        acl:accessTo <${groupDoc}>;
        acl:mode acl:Read;
        acl:agentClass foaf:Agent;
        acl:agentGroup <${groupUri}>.
      <#Append> a acl:Authorization;
        acl:accessTo <${groupDoc}>;
        acl:mode acl:Append;
        acl:agentClass acl:AuthenticatedAgent.
        `,
    })
  })
  return cy.wrap({
    community: communityUri,
    group: groupUri,
  } as CommunityConfig)
}

export type SkipOptions =
  | 'personalHospexDocument'
  | 'publicTypeIndex'
  | 'privateTypeIndex'
  | 'joinCommunity'
  | 'inbox'

export const setupPod = (
  user: UserConfig,
  community: CommunityConfig,
  {
    skip = [],
    hospexContainerName = 'test-community',
  }: { skip?: SkipOptions[]; hospexContainerName?: string } = {},
) => {
  const publicTypeIndexUri = `${user.podUrl}settings/publicTypeIndex.ttl`
  const privateTypeIndexUri = `${user.podUrl}settings/privateTypeIndex.ttl`
  const hospexContainer = `${user.podUrl}hospex/${hospexContainerName}/`
  const hospexDocument = hospexContainer + 'card'
  const inboxUri = `${user.podUrl}inbox/`

  // create inbox
  if (!skip.includes('inbox')) {
    cy.authenticatedRequest(user, {
      url: inboxUri,
      method: 'PUT',
      headers: {
        Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
        'content-type': 'text/turtle',
      },
    })
    cy.authenticatedRequest(user, {
      url: inboxUri + '.acl',
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.

      <#Append>
        a acl:Authorization;
        acl:agentClass acl:AuthenticatedAgent;
        acl:accessTo <./>;
        acl:default <./>;
        acl:mode acl:Append.
      <#ControlReadWrite>
        a acl:Authorization;
        acl:agent <${user.webId}>;
        acl:accessTo <./>;
        acl:default <./>;
        acl:mode acl:Control, acl:Read, acl:Write.`,
    })
    cy.authenticatedRequest(user, {
      url: user.webId,
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: `
      _:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
        <${user.webId}> <${ldp.inbox}> <${inboxUri}>.
      }.`,
    })
  }
  // create public type index
  if (!skip.includes('publicTypeIndex')) {
    cy.authenticatedRequest(user, {
      url: publicTypeIndexUri,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix solid: <http://www.w3.org/ns/solid/terms#>.
      <> a solid:ListedDocument, solid:TypeIndex.`,
    })
    cy.authenticatedRequest(user, {
      url: publicTypeIndexUri + '.acl',
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.
      @prefix foaf: <http://xmlns.com/foaf/0.1/>.

      <#owner> a acl:Authorization;
        acl:agent <${user.webId}>;
        acl:accessTo <./publicTypeIndex.ttl>;
        acl:mode acl:Read, acl:Write, acl:Control.

      <#public> a acl:Authorization;
        acl:agentClass foaf:Agent;
        acl:accessTo <./publicTypeIndex.ttl>;
        acl:mode acl:Read.
      `,
    })
    cy.authenticatedRequest(user, {
      url: user.webId,
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: `
      _:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
        <${user.webId}> <${solid.publicTypeIndex}> <${publicTypeIndexUri}>.
      }.`,
    })
  }
  // create private type index
  if (!skip.includes('privateTypeIndex')) {
    cy.authenticatedRequest(user, {
      url: privateTypeIndexUri,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix solid: <http://www.w3.org/ns/solid/terms#>.
      <> a solid:UnlistedDocument, solid:TypeIndex.`,
    })
    cy.authenticatedRequest(user, {
      url: privateTypeIndexUri + '.acl',
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.
      <#owner> a acl:Authorization;
        acl:agent <${user.webId}>;
        acl:accessTo <./privateTypeIndex.ttl>;
        acl:mode acl:Read, acl:Write, acl:Control.`,
    })
    cy.authenticatedRequest(user, {
      url: user.webId,
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: `
      _:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
        <${user.webId}> <${solid.privateTypeIndex}> <${privateTypeIndexUri}>.
      }.`,
    })
  }
  // create hospex document
  if (!skip.includes('personalHospexDocument')) {
    const communityUri = community.community
    cy.authenticatedRequest(user, {
      url: hospexDocument,
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix sioc: <http://rdfs.org/sioc/ns#>.
      @prefix hospex: <http://w3id.org/hospex/ns#>.
      <${user.webId}> sioc:member_of <${communityUri}>;
        hospex:storage <${hospexContainer}>.`,
    })
    cy.authenticatedRequest(user, {
      url: hospexContainer + '.acl',
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.
      <#owner> a acl:Authorization;
        acl:accessTo <${hospexContainer}>;
        acl:agent <${user.webId}>;
        acl:default <${hospexContainer}>;
        acl:mode acl:Read, acl:Write, acl:Control.
      <#read> a acl:Authorization;
        acl:accessTo <${hospexContainer}>;
        acl:agentGroup <${community.group}>;
        acl:default <${hospexContainer}>;
        acl:mode acl:Read.
      `,
    })
    cy.authenticatedRequest(user, {
      url: publicTypeIndexUri,
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: `
      @prefix hospex: <http://w3id.org/hospex/ns#>.
      _:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
        <> <${dct.references}> <#hospex>.
        <#hospex> a <${solid.TypeRegistration}>;
        <${solid.forClass}> hospex:PersonalHospexDocument;
        <${solid.instance}> <${hospexDocument}>.
      }.`,
    })
  }

  // join community
  if (!skip.includes('joinCommunity')) {
    cy.authenticatedRequest(user, {
      url: community.group,
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: `
      _:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
        <${community.group}> <${vcard.hasMember}> <${user.webId}>.
      }.`,
    })
  }

  return cy.wrap({
    publicTypeIndex: publicTypeIndexUri,
    privateTypeIndex: privateTypeIndexUri,
    hospexContainer,
    hospexProfile: hospexDocument,
    inbox: inboxUri,
  } as SetupConfig)
}

export const setStorage = (user: UserConfig) => {
  cy.authenticatedRequest(user, {
    url: user.webId,
    method: 'PATCH',
    body: `_:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
        <${user.webId}> <${space.storage}> <${user.podUrl}>.
      }.`,
    headers: { 'content-type': 'text/n3' },
  })
}

/**
 * Set data on person's hospex profile
 * This can only be run once per person,
 * because we don't care about deleting previous data
 */
export type Profile = { name: string; description: { [lang: string]: string } }
export const setProfileData = (
  user: UserConfig,
  setup: SetupConfig,
  profile: Profile,
) => {
  const descriptions = Object.entries(profile.description)
    .map(
      ([language, description]) =>
        `<${user.webId}> <${vcard.note}> """${description}"""@${language}.`,
    )
    .join('\n')
  cy.authenticatedRequest(user, {
    url: setup.hospexProfile,
    method: 'PATCH',
    headers: { 'content-type': 'text/n3' },
    body: `_:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
      <${user.webId}> <${foaf.name}> "${profile.name}".
      ${descriptions}
    }.`,
  })
}

export type AccommodationData = {
  description: { [lang: string]: string }
  location: [number, number]
}

export type AccommodationConfig = {
  id: string
  doc: string
} & AccommodationData

export const addAccommodation = (
  person: Person,
  accommodation: AccommodationData,
) => {
  return cy
    .authenticatedRequest(person, {
      url: person.hospexContainer,
      method: 'POST',
      headers: { 'content-type': 'text/turtle' },
      body: accommodationTurtle({ user: person, accommodation }),
    })
    .then(response => {
      const location = response.headers.location as string
      cy.authenticatedRequest(person, {
        url: person.hospexProfile,
        method: 'PATCH',
        headers: { 'content-type': 'text/n3' },
        body: `@prefix hospex: <http://w3id.org/hospex/ns#>.
    _:mutate a <${solid.InsertDeletePatch}>; <${solid.inserts}> {
      <${person.webId}> hospex:offers <${location}#accommodation>.
    }.`,
      })

      return cy.wrap({
        ...accommodation,
        id: `${location}#accommodation`,
        doc: location,
      } as AccommodationConfig)
    })
}

const accommodationTurtle = ({
  user,
  accommodation,
}: {
  user: UserConfig
  accommodation: AccommodationData
}) => `
@prefix : <#>.
@prefix hospex: <http://w3id.org/hospex/ns#>.
@prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>.
:accommodation a hospex:Accommodation, <${schema_https.Accommodation}>;
    geo:location :location;
  ${Object.entries(accommodation.description)
    .map(
      ([language, description]) =>
        `<${dct.description}> """${description}"""@${language};`,
    )
    .join('\n')}
    hospex:offeredBy <${user.webId}>.
:location a geo:Point;
    geo:lat "${
      accommodation.location[0]
    }"^^<http://www.w3.org/2001/XMLSchema#decimal>;
    geo:long "${
      accommodation.location[1]
    }"^^<http://www.w3.org/2001/XMLSchema#decimal>.
`

export const stubMailer = ({
  person,
  mailer = 'http://localhost:3005',
  integrated = true,
  verified = true,
}: {
  person: Pick<Person, 'webId' | 'inbox'>
  mailer?: string
  integrated?: boolean
  verified?: boolean
}): void => {
  cy.intercept('GET', `${mailer}/status`, {
    statusCode: 200,
    body: {
      actor: person.webId,
      integrations: integrated
        ? [{ object: person.inbox, target: 'asdf@example.com', verified }]
        : [],
    },
  })
}
