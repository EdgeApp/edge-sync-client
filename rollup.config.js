import resolve from '@rollup/plugin-node-resolve'
import sucrase from '@rollup/plugin-sucrase'
import flowEntry from 'rollup-plugin-flow-entry'
import mjsEntry from 'rollup-plugin-mjs-entry'

import packageJson from './package.json'

const extensions = ['.ts']

export default {
  external: [/@babel\/runtime/, ...Object.keys(packageJson.dependencies)],
  input: 'src/index.ts',
  output: [
    { file: packageJson.main, format: 'cjs' },
    { file: packageJson.module, format: 'esm' }
  ],
  plugins: [
    resolve({ extensions }),
    sucrase({
      exclude: ['node_modules/**'],
      transforms: ['typescript']
    }),
    flowEntry({ types: 'src/index.flow.js' }),
    mjsEntry()
  ]
}
