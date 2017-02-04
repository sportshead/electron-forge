import 'colors';

import asyncOra from '../util/ora-handler';
import getForgeConfig from '../util/forge-config';
import readPackageJSON from '../util/read-package-json';
import requireSearch from '../util/require-search';
import resolveDir from '../util/resolve-dir';

import make from './make';

/**
 * @typedef {Object} PublishOptions
 * @property {string} [dir=process.cwd()] The path to the app to be published
 * @property {boolean} [interactive=false] Whether to use sensible defaults or prompt the user visually
 * @property {string} [authToken] An authentication token to use when publishing
 * @property {string} [tag=packageJSON.version] The string to tag this release with
 * @property {string} [target=github] The publish target
 * @property {MakeOptions} [makeOptions] Options object to passed through to make()
 */

/**
 * Publish an Electron application into the given target service.
 *
 * @param {PublishOptions} providedOptions - Options for the Publish method
 * @return {Promise} Will resolve when the publish process is complete
 */
export default async (providedOptions = {}) => {
  // eslint-disable-next-line prefer-const, no-unused-vars
  let { dir, interactive, authToken, tag, target, makeOptions } = Object.assign({
    dir: process.cwd(),
    interactive: false,
    tag: null,
    makeOptions: {},
    target: null,
  }, providedOptions);
  asyncOra.interactive = interactive;
  // FIXME(MarshallOfSound): Change the method param to publishTargets in the next major bump
  let publishTargets = target;

  const makeResults = await make(Object.assign({
    dir,
    interactive,
  }, makeOptions));

  dir = await resolveDir(dir);
  if (!dir) {
    throw 'Failed to locate publishable Electron application';
  }

  const artifacts = makeResults.reduce((accum, arr) => {
    accum.push(...arr);
    return accum;
  }, []);

  const packageJSON = await readPackageJSON(dir);

  const forgeConfig = await getForgeConfig(dir);

  if (publishTargets === null) {
    publishTargets = forgeConfig.publish_targets[makeOptions.platform || process.platform];
  } else if (typeof publishTargets === 'string') {
    // FIXME(MarshallOfSound): Remove this fallback string typeof check in the next major bump
    publishTargets = [publishTargets];
  }

  for (const publishTarget of publishTargets) {
    let publisher;
    await asyncOra(`Resolving publish target: ${`${publishTarget}`.cyan}`, async () => {
      publisher = requireSearch(__dirname, [
        `../publishers/${publishTarget}.js`,
        `electron-forge-publisher-${publishTarget}`,
      ]);
      if (!publisher) {
        throw `Could not find a publish target with the name: ${publishTarget}`;
      }
    });

    await publisher(artifacts, packageJSON, forgeConfig, authToken, tag);
  }
};
