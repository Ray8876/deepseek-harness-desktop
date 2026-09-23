import { get, isString } from 'lodash-es'
import { WORKTREE_SECTION_ORDER } from '../../shared/constants'
import { ledger } from '../service/ledger'
import { worktreeSectionText } from '../utils/worktree-facts'

export const worktreeSectionProvider = {
  name: 'plugin:dsh-tauri-worktree',
  order: WORKTREE_SECTION_ORDER,
  text(context: any): string {
    const sessionId = get(context, 'scope.session.id')
    if (!isString(sessionId))
      return ''
    const binding = ledger.load(sessionId)
    if (!binding)
      return ''
    return worktreeSectionText(binding)
  },
}
