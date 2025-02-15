const core = require('@actions/core')
const nock = require('nock')

const { Deployment, MAX_TIMEOUT, ONE_GIGABYTE, SIZE_LIMIT_DESCRIPTION } = require('../../internal/deployment')

const fakeJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiNjllMWIxOC1jOGFiLTRhZGQtOGYxOC03MzVlMzVjZGJhZjAiLCJzdWIiOiJyZXBvOnBhcGVyLXNwYS9taW55aTplbnZpcm9ubWVudDpQcm9kdWN0aW9uIiwiYXVkIjoiaHR0cHM6Ly9naXRodWIuY29tL3BhcGVyLXNwYSIsInJlZiI6InJlZnMvaGVhZHMvbWFpbiIsInNoYSI6ImEyODU1MWJmODdiZDk3NTFiMzdiMmM0YjM3M2MxZjU3NjFmYWM2MjYiLCJyZXBvc2l0b3J5IjoicGFwZXItc3BhL21pbnlpIiwicmVwb3NpdG9yeV9vd25lciI6InBhcGVyLXNwYSIsInJ1bl9pZCI6IjE1NDY0NTkzNjQiLCJydW5fbnVtYmVyIjoiMzQiLCJydW5fYXR0ZW1wdCI6IjIiLCJhY3RvciI6IllpTXlzdHkiLCJ3b3JrZmxvdyI6IkNJIiwiaGVhZF9yZWYiOiIiLCJiYXNlX3JlZiI6IiIsImV2ZW50X25hbWUiOiJwdXNoIiwicmVmX3R5cGUiOiJicmFuY2giLCJlbnZpcm9ubWVudCI6IlByb2R1Y3Rpb24iLCJqb2Jfd29ya2Zsb3dfcmVmIjoicGFwZXItc3BhL21pbnlpLy5naXRodWIvd29ya2Zsb3dzL2JsYW5rLnltbEByZWZzL2hlYWRzL21haW4iLCJpc3MiOiJodHRwczovL3Rva2VuLmFjdGlvbnMuZ2l0aHVidXNlcmNvbnRlbnQuY29tIiwibmJmIjoxNjM4ODI4MDI4LCJleHAiOjE2Mzg4Mjg5MjgsImlhdCI6MTYzODgyODYyOH0.1wyupfxu1HGoTyIqatYg0hIxy2-0bMO-yVlmLSMuu2w'

describe('Deployment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GITHUB_RUN_ID = '123'
    process.env.GITHUB_REPOSITORY = 'actions/is-awesome'
    process.env.GITHUB_TOKEN = 'gha-token'
    process.env.GITHUB_SHA = '123abc'
    process.env.GITHUB_ACTOR = 'monalisa'
    process.env.GITHUB_ACTION = '__monalisa/octocat'
    process.env.GITHUB_ACTION_PATH = 'something'

    jest.spyOn(core, 'getInput').mockImplementation(param => {
      switch (param) {
        case 'artifact_name':
          return 'github-pages'
        case 'token':
          return process.env.GITHUB_TOKEN
        default:
          return process.env[`INPUT_${param.toUpperCase()}`] || ''
      }
    })

    jest.spyOn(core, 'setOutput').mockImplementation(param => {
      return param
    })

    jest.spyOn(core, 'setFailed').mockImplementation(param => {
      return param
    })
    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(jest.fn())
    jest.spyOn(core, 'warning').mockImplementation(jest.fn())
    jest.spyOn(core, 'info').mockImplementation(jest.fn())
    jest.spyOn(core, 'debug').mockImplementation(jest.fn())
  })

  describe('#create', () => {
    afterEach(() => {
      // Remove mock for `core.getInput('preview')`
      delete process.env.INPUT_PREVIEW
    })

    it('can successfully create a deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`^Created deployment for ${process.env.GITHUB_SHA}`))
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('can successfully create a preview deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt,
          preview: true
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome',
          preview_url: 'https://actions.drafts.github.io/is-awesome'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Return `"true"` for `core.getInput("preview")`
      process.env.INPUT_PREVIEW = 'true'

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`^Created deployment for ${process.env.GITHUB_SHA}`))
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('reports errors with failed artifact metadata exchange', async () => {
      process.env.GITHUB_SHA = 'invalid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(400, { message: 'Bad request' })

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 400) with build version ${process.env.GITHUB_SHA}. Responded with: Bad request`
        )
      )

      artifactMetadataScope.done()
    })

    it('reports errors with a failed 500 in a deployment', async () => {
      process.env.GITHUB_SHA = 'build-version'
      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA
        })
        .reply(500, { message: 'oh no' })

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 500) with build version ${process.env.GITHUB_SHA}. Server error, is githubstatus.com reporting a Pages outage? Please re-run the deployment at a later time.`
        )
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('reports errors with an unexpected 403 during deployment', async () => {
      process.env.GITHUB_SHA = 'build-version'
      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA
        })
        .reply(403, { message: 'You are forbidden' })

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 403) with build version ${process.env.GITHUB_SHA}. Ensure GITHUB_TOKEN has permission "pages: write".`
        )
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('reports errors with an unexpected 404 during deployment', async () => {
      process.env.GITHUB_SHA = 'build-version'
      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA
        })
        .reply(404, { message: 'Not found' })

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 404) with build version ${process.env.GITHUB_SHA}. Ensure GitHub Pages has been enabled: https://github.com/actions/is-awesome/settings/pages`
        )
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('reports errors with failed deployments', async () => {
      process.env.GITHUB_SHA = 'invalid-build-version'
      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA
        })
        .reply(400, { message: 'Bad request' })

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 400) with build version ${process.env.GITHUB_SHA}. Responded with: Bad request`
        )
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('fails if there are multiple artifacts with the same name', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 2,
          artifacts: [
            {
              id: 13,
              name: `github-pages`,
              size_in_bytes: 1400
            },
            {
              id: 14,
              name: `github-pages`,
              size_in_bytes: 1620
            }
          ]
        })

      const deployment = new Deployment()
      await expect(deployment.create(fakeJwt)).rejects.toThrow(
        `Multiple artifact unexpectedly found for workflow run ${process.env.GITHUB_RUN_ID}. Artifact count is 2.`
      )

      artifactMetadataScope.done()
    })

    it('fails if there are no artifacts found', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 0,
          artifacts: []
        })

      const deployment = new Deployment()
      await expect(deployment.create(fakeJwt)).rejects.toThrow(
        `No artifacts found for workflow run ${process.env.GITHUB_RUN_ID}. Ensure artifacts are uploaded with actions/artifact@v4 or later.`
      )

      artifactMetadataScope.done()
    })

    it('fails with error message if list artifact endpoint returns 500', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(500, { message: 'oh no' })

      const deployment = new Deployment()
      await expect(deployment.create(fakeJwt)).rejects.toThrow(
        `Failed to create deployment (status: 500) with build version valid-build-version. Server error, is githubstatus.com reporting a Pages outage? Please re-run the deployment at a later time.`
      )

      artifactMetadataScope.done()
    })

    it('warns if the artifact size is bigger than maximum', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'
      const artifactSize = ONE_GIGABYTE + 1

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [
            {
              id: 12,
              name: `github-pages`,
              size_in_bytes: `${artifactSize}`
            }
          ]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 12,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      expect(core.warning).toBeCalledWith(
        `Uploaded artifact size of ${artifactSize} bytes exceeds the allowed size of ${SIZE_LIMIT_DESCRIPTION}. Deployment might fail.`
      )
      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`^Created deployment for ${process.env.GITHUB_SHA}`))
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('warns when the timeout is greater than the maximum allowed', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      jest.spyOn(core, 'getInput').mockImplementation(param => {
        switch (param) {
          case 'artifact_name':
            return 'github-pages'
          case 'token':
            return process.env.GITHUB_TOKEN
          case 'timeout':
            return MAX_TIMEOUT + 1
          default:
            return process.env[`INPUT_${param.toUpperCase()}`] || ''
        }
      })

      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      expect(core.warning).toBeCalledWith(
        `Warning: timeout value is greater than the allowed maximum - timeout set to the maximum of ${MAX_TIMEOUT} milliseconds.`
      )

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })
  })

  describe('#check', () => {
    it('sets output to success when deployment is successful', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const deploymentStatusScope = nock('https://api.github.com')
        .get(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`)
        .reply(200, {
          status: 'succeed'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)
      await deployment.check()

      expect(core.setOutput).toBeCalledWith('status', 'succeed')
      expect(core.info).toHaveBeenLastCalledWith('Reported success!')

      artifactMetadataScope.done()
      createDeploymentScope.done()
      deploymentStatusScope.done()
    })

    it('fails check when no deployment is found', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'
      const deployment = new Deployment()
      await deployment.check()
      expect(core.setFailed).toBeCalledWith('Deployment not found.')
    })

    it('exits early when deployment is not in progress', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      const deployment = new Deployment()
      await deployment.create(fakeJwt)
      deployment.deploymentInfo.pending = false
      await deployment.check()
      expect(core.setFailed).toBeCalledWith('Unable to get deployment status.')

      artifactMetadataScope.done()
      createDeploymentScope.done()
    })

    it('enforces max timeout', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const cancelDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}/cancel`)
        .reply(200, {})

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Set timeout to great than max
      jest.spyOn(core, 'getInput').mockImplementation(param => {
        switch (param) {
          case 'artifact_name':
            return 'github-pages'
          case 'token':
            return process.env.GITHUB_TOKEN
          case 'error_count':
            return 10
          case 'timeout':
            return MAX_TIMEOUT + 1
          default:
            return process.env[`INPUT_${param.toUpperCase()}`] || ''
        }
      })

      const now = Date.now()
      const mockStartTime = now - MAX_TIMEOUT
      jest
        .spyOn(Date, 'now')
        .mockImplementationOnce(() => mockStartTime)
        .mockImplementationOnce(() => now)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)
      await deployment.check()

      expect(deployment.timeout).toEqual(MAX_TIMEOUT)
      expect(core.error).toBeCalledWith('Timeout reached, aborting!')
      expect(core.setFailed).toBeCalledWith('Timeout reached, aborting!')

      artifactMetadataScope.done()
      createDeploymentScope.done()
      cancelDeploymentScope.done()
    })

    it('sets timeout to user timeout if user timeout is less than max timeout', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const cancelDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}/cancel`)
        .reply(200, {})

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Set timeout to great than max
      jest.spyOn(core, 'getInput').mockImplementation(param => {
        switch (param) {
          case 'artifact_name':
            return 'github-pages'
          case 'token':
            return process.env.GITHUB_TOKEN
          case 'error_count':
            return 10
          case 'timeout':
            return 42
          default:
            return process.env[`INPUT_${param.toUpperCase()}`] || ''
        }
      })

      const now = Date.now()
      const mockStartTime = now - 42
      jest
        .spyOn(Date, 'now')
        .mockImplementationOnce(() => mockStartTime)
        .mockImplementationOnce(() => now)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)
      await deployment.check()

      expect(deployment.timeout).toEqual(42)
      expect(core.error).toBeCalledWith('Timeout reached, aborting!')
      expect(core.setFailed).toBeCalledWith('Timeout reached, aborting!')

      artifactMetadataScope.done()
      createDeploymentScope.done()
      cancelDeploymentScope.done()
    })

    it('sets output to success when timeout is set but not reached', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const deploymentStatusScope = nock('https://api.github.com')
        .get(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`)
        .reply(200, {
          status: 'succeed'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Set timeout to great than max
      jest.spyOn(core, 'getInput').mockImplementation(param => {
        switch (param) {
          case 'artifact_name':
            return 'github-pages'
          case 'token':
            return process.env.GITHUB_TOKEN
          case 'error_count':
            return 10
          case 'timeout':
            return 42
          default:
            return process.env[`INPUT_${param.toUpperCase()}`] || ''
        }
      })

      const now = Date.now()
      const mockStartTime = now
      jest
        .spyOn(Date, 'now')
        .mockImplementationOnce(() => mockStartTime)
        .mockImplementationOnce(() => now)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)
      await deployment.check()

      expect(deployment.timeout).toEqual(42)
      expect(core.error).not.toBeCalled()
      expect(core.setOutput).toBeCalledWith('status', 'succeed')
      expect(core.info).toHaveBeenLastCalledWith('Reported success!')

      artifactMetadataScope.done()
      createDeploymentScope.done()
      deploymentStatusScope.done()
    })
  })

  describe('#cancel', () => {
    it('can successfully cancel a deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const cancelDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}/cancel`)
        .reply(200, {})

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      // Cancel it
      await deployment.cancel()

      expect(core.info).toHaveBeenLastCalledWith(`Canceled deployment with ID ${process.env.GITHUB_SHA}`)

      artifactMetadataScope.done()
      createDeploymentScope.done()
      cancelDeploymentScope.done()
    })

    it('can exit if a pages deployment was not created and none need to be cancelled', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      // Create the deployment
      const deployment = new Deployment()

      // Cancel it
      await deployment.cancel()

      expect(core.debug).toHaveBeenCalledWith('all variables are set')
      expect(core.debug).toHaveBeenCalledWith(`No deployment to cancel`)
    })

    it('catches an error when trying to cancel a deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactMetadataScope = nock(`https://api.github.com`)
        .get(
          `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?name=github-pages`
        )
        .reply(200, {
          total_count: 1,
          artifacts: [{ id: 11, name: `github-pages`, size_in_bytes: 221 }]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_id: 11,
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      // nock will throw an error every time it tries to cancel the deployment
      const cancelDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}/cancel`)
        .reply(500, {})

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      // Cancel it
      await deployment.cancel()

      expect(core.error).toHaveBeenCalledWith(`Canceling Pages deployment failed`, expect.anything())

      artifactMetadataScope.done()
      createDeploymentScope.done()
      cancelDeploymentScope.done()
    })
  })
})
