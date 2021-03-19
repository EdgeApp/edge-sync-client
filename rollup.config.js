import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import flowEntry from 'rollup-plugin-flow-entry'
import mjsEntry from 'rollup-plugin-mjs-entry'

import packageJson from './package.json'

const extensions = ['.ts']
const babelOpts = {
  babelHelpers: 'bundled',
  babelrc: false,
  extensions,
  include: ['src/**/*'],
  presets: ['@babel/preset-env', '@babel/typescript']
}
const resolveOpts = { extensions }

export default {
  input: 'src/index.ts',
  output: [
    { file: packageJson.main, format: 'cjs' },
    { file: packageJson.module, format: 'esm' }
  ],
  plugins: [
    resolve(resolveOpts),
    babel(babelOpts),
    flowEntry({ types: 'src/index.flow.js' }),
    mjsEntry()
  ]
}
