// WAI-ARIA: https://www.w3.org/TR/wai-aria-practices-1.2/#menubutton
import React, {
  createContext,
  createRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  Fragment,

  // Types
  Dispatch,
  ElementType,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  Ref,
} from 'react'

import { Props } from '../../types'
import { match } from '../../utils/match'
import { forwardRefWithAs, render, Features, PropsForFeatures } from '../../utils/render'
import { disposables } from '../../utils/disposables'
import { useDisposables } from '../../hooks/use-disposables'
import { useIsoMorphicEffect } from '../../hooks/use-iso-morphic-effect'
import { useSyncRefs } from '../../hooks/use-sync-refs'
import { useId } from '../../hooks/use-id'
import { Keys } from '../keyboard'
import { Focus, calculateActiveIndex } from '../../utils/calculate-active-index'
import { resolvePropValue } from '../../utils/resolve-prop-value'
import { isDisabledReactIssue7711 } from '../../utils/bugs'
import { isFocusableElement, FocusableMode } from '../../utils/focus-management'

enum MenuStates {
  Open,
  Closed,
}

type MenuItemDataRef = MutableRefObject<{ textValue?: string; disabled: boolean }>

interface StateDefinition {
  menuState: MenuStates
  buttonRef: MutableRefObject<HTMLButtonElement | null>
  itemsRef: MutableRefObject<HTMLDivElement | null>
  items: { id: string; dataRef: MenuItemDataRef }[]
  searchQuery: string
  activeItemIndex: number | null
}

enum ActionTypes {
  OpenMenu,
  CloseMenu,

  GoToItem,
  Search,
  ClearSearch,
  RegisterItem,
  UnregisterItem,
}

type Actions =
  | { type: ActionTypes.CloseMenu }
  | { type: ActionTypes.OpenMenu }
  | { type: ActionTypes.GoToItem; focus: Focus.Specific; id: string }
  | { type: ActionTypes.GoToItem; focus: Exclude<Focus, Focus.Specific> }
  | { type: ActionTypes.Search; value: string }
  | { type: ActionTypes.ClearSearch }
  | { type: ActionTypes.RegisterItem; id: string; dataRef: MenuItemDataRef }
  | { type: ActionTypes.UnregisterItem; id: string }

let reducers: {
  [P in ActionTypes]: (
    state: StateDefinition,
    action: Extract<Actions, { type: P }>
  ) => StateDefinition
} = {
  [ActionTypes.CloseMenu](state) {
    if (state.menuState === MenuStates.Closed) return state
    return { ...state, activeItemIndex: null, menuState: MenuStates.Closed }
  },
  [ActionTypes.OpenMenu](state) {
    if (state.menuState === MenuStates.Open) return state
    return { ...state, menuState: MenuStates.Open }
  },
  [ActionTypes.GoToItem]: (state, action) => {
    let activeItemIndex = calculateActiveIndex(action, {
      resolveItems: () => state.items,
      resolveActiveIndex: () => state.activeItemIndex,
      resolveId: item => item.id,
      resolveDisabled: item => item.dataRef.current.disabled,
    })

    if (state.searchQuery === '' && state.activeItemIndex === activeItemIndex) return state
    return { ...state, searchQuery: '', activeItemIndex }
  },
  [ActionTypes.Search]: (state, action) => {
    let searchQuery = state.searchQuery + action.value
    let match = state.items.findIndex(
      item =>
        item.dataRef.current.textValue?.startsWith(searchQuery) && !item.dataRef.current.disabled
    )

    if (match === -1 || match === state.activeItemIndex) return { ...state, searchQuery }
    return { ...state, searchQuery, activeItemIndex: match }
  },
  [ActionTypes.ClearSearch](state) {
    if (state.searchQuery === '') return state
    return { ...state, searchQuery: '' }
  },
  [ActionTypes.RegisterItem]: (state, action) => ({
    ...state,
    items: [...state.items, { id: action.id, dataRef: action.dataRef }],
  }),
  [ActionTypes.UnregisterItem]: (state, action) => {
    let nextItems = state.items.slice()
    let currentActiveItem = state.activeItemIndex !== null ? nextItems[state.activeItemIndex] : null

    let idx = nextItems.findIndex(a => a.id === action.id)

    if (idx !== -1) nextItems.splice(idx, 1)

    return {
      ...state,
      items: nextItems,
      activeItemIndex: (() => {
        if (idx === state.activeItemIndex) return null
        if (currentActiveItem === null) return null

        // If we removed the item before the actual active index, then it would be out of sync. To
        // fix this, we will find the correct (new) index position.
        return nextItems.indexOf(currentActiveItem)
      })(),
    }
  },
}

let MenuContext = createContext<[StateDefinition, Dispatch<Actions>] | null>(null)
MenuContext.displayName = 'MenuContext'

function useMenuContext(component: string) {
  let context = useContext(MenuContext)
  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <${Menu.name} /> component.`)
    if (Error.captureStackTrace) Error.captureStackTrace(err, useMenuContext)
    throw err
  }
  return context
}

function stateReducer(state: StateDefinition, action: Actions) {
  return match(action.type, reducers, state, action)
}

// ---

let DEFAULT_MENU_TAG = Fragment
interface MenuRenderPropArg {
  open: boolean
}

export function Menu<TTag extends ElementType = typeof DEFAULT_MENU_TAG>(
  props: Props<TTag, MenuRenderPropArg>
) {
  let reducerBag = useReducer(stateReducer, {
    menuState: MenuStates.Closed,
    buttonRef: createRef(),
    itemsRef: createRef(),
    items: [],
    searchQuery: '',
    activeItemIndex: null,
  } as StateDefinition)
  let [{ menuState, itemsRef, buttonRef }, dispatch] = reducerBag

  // Handle outside click
  useEffect(() => {
    function handler(event: MouseEvent) {
      let target = event.target as HTMLElement

      if (menuState !== MenuStates.Open) return

      if (buttonRef.current?.contains(target)) return
      if (itemsRef.current?.contains(target)) return

      dispatch({ type: ActionTypes.CloseMenu })

      if (!isFocusableElement(target, FocusableMode.Loose)) {
        event.preventDefault()
        buttonRef.current?.focus()
      }
    }

    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [menuState, buttonRef, itemsRef, dispatch])

  let propsBag = useMemo<MenuRenderPropArg>(() => ({ open: menuState === MenuStates.Open }), [
    menuState,
  ])

  return (
    <MenuContext.Provider value={reducerBag}>
      {render(props, propsBag, DEFAULT_MENU_TAG)}
    </MenuContext.Provider>
  )
}

// ---

let DEFAULT_BUTTON_TAG = 'button' as const
interface ButtonRenderPropArg {
  open: boolean
}
type ButtonPropsWeControl =
  | 'id'
  | 'type'
  | 'aria-haspopup'
  | 'aria-controls'
  | 'aria-expanded'
  | 'onKeyDown'
  | 'onClick'

let Button = forwardRefWithAs(function Button<TTag extends ElementType = typeof DEFAULT_BUTTON_TAG>(
  props: Props<TTag, ButtonRenderPropArg, ButtonPropsWeControl>,
  ref: Ref<HTMLButtonElement>
) {
  let [state, dispatch] = useMenuContext([Menu.name, Button.name].join('.'))
  let buttonRef = useSyncRefs(state.buttonRef, ref)

  let id = `headlessui-menu-button-${useId()}`
  let d = useDisposables()

  let handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      switch (event.key) {
        // Ref: https://www.w3.org/TR/wai-aria-practices-1.2/#keyboard-interaction-13

        case Keys.Space:
        case Keys.Enter:
        case Keys.ArrowDown:
          event.preventDefault()
          dispatch({ type: ActionTypes.OpenMenu })
          d.nextFrame(() => {
            state.itemsRef.current?.focus({ preventScroll: true })
            dispatch({ type: ActionTypes.GoToItem, focus: Focus.First })
          })
          break

        case Keys.ArrowUp:
          event.preventDefault()
          dispatch({ type: ActionTypes.OpenMenu })
          d.nextFrame(() => {
            state.itemsRef.current?.focus({ preventScroll: true })
            dispatch({ type: ActionTypes.GoToItem, focus: Focus.Last })
          })
          break
      }
    },
    [dispatch, state, d]
  )

  let handleClick = useCallback(
    (event: ReactMouseEvent) => {
      if (isDisabledReactIssue7711(event.currentTarget)) return event.preventDefault()
      if (props.disabled) return
      if (state.menuState === MenuStates.Open) {
        dispatch({ type: ActionTypes.CloseMenu })
        d.nextFrame(() => state.buttonRef.current?.focus({ preventScroll: true }))
      } else {
        event.preventDefault()
        dispatch({ type: ActionTypes.OpenMenu })
        d.nextFrame(() => state.itemsRef.current?.focus({ preventScroll: true }))
      }
    },
    [dispatch, d, state, props.disabled]
  )

  let propsBag = useMemo<ButtonRenderPropArg>(
    () => ({ open: state.menuState === MenuStates.Open }),
    [state]
  )
  let passthroughProps = props
  let propsWeControl = {
    ref: buttonRef,
    id,
    type: 'button',
    'aria-haspopup': true,
    'aria-controls': state.itemsRef.current?.id,
    'aria-expanded': state.menuState === MenuStates.Open ? true : undefined,
    onKeyDown: handleKeyDown,
    onClick: handleClick,
  }

  return render({ ...passthroughProps, ...propsWeControl }, propsBag, DEFAULT_BUTTON_TAG)
})

// ---

let DEFAULT_ITEMS_TAG = 'div' as const
interface ItemsRenderPropArg {
  open: boolean
}
type ItemsPropsWeControl =
  | 'aria-activedescendant'
  | 'aria-labelledby'
  | 'id'
  | 'onKeyDown'
  | 'role'
  | 'tabIndex'

let ItemsRenderFeatures = Features.RenderStrategy | Features.Static

let Items = forwardRefWithAs(function Items<TTag extends ElementType = typeof DEFAULT_ITEMS_TAG>(
  props: Props<TTag, ItemsRenderPropArg, ItemsPropsWeControl> &
    PropsForFeatures<typeof ItemsRenderFeatures>,
  ref: Ref<HTMLDivElement>
) {
  let [state, dispatch] = useMenuContext([Menu.name, Items.name].join('.'))
  let itemsRef = useSyncRefs(state.itemsRef, ref)

  let id = `headlessui-menu-items-${useId()}`
  let searchDisposables = useDisposables()

  useIsoMorphicEffect(() => {
    let container = state.itemsRef.current
    if (!container) return
    if (state.menuState !== MenuStates.Open) return

    let walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node: HTMLElement) {
        if (node.getAttribute('role') === 'menuitem') return NodeFilter.FILTER_REJECT
        if (node.hasAttribute('role')) return NodeFilter.FILTER_SKIP
        return NodeFilter.FILTER_ACCEPT
      },
    })

    while (walker.nextNode()) {
      ;(walker.currentNode as HTMLElement).setAttribute('role', 'none')
    }
  })

  let handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      searchDisposables.dispose()

      switch (event.key) {
        // Ref: https://www.w3.org/TR/wai-aria-practices-1.2/#keyboard-interaction-12

        // @ts-expect-error Fallthrough is expected here
        case Keys.Space:
          if (state.searchQuery !== '') {
            event.preventDefault()
            return dispatch({ type: ActionTypes.Search, value: event.key })
          }
        // When in type ahead mode, fallthrough
        case Keys.Enter:
          event.preventDefault()
          dispatch({ type: ActionTypes.CloseMenu })
          if (state.activeItemIndex !== null) {
            let { id } = state.items[state.activeItemIndex]
            document.getElementById(id)?.click()
          }
          disposables().nextFrame(() => state.buttonRef.current?.focus({ preventScroll: true }))
          break

        case Keys.ArrowDown:
          event.preventDefault()
          return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Next })

        case Keys.ArrowUp:
          event.preventDefault()
          return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Previous })

        case Keys.Home:
        case Keys.PageUp:
          event.preventDefault()
          return dispatch({ type: ActionTypes.GoToItem, focus: Focus.First })

        case Keys.End:
        case Keys.PageDown:
          event.preventDefault()
          return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Last })

        case Keys.Escape:
          event.preventDefault()
          dispatch({ type: ActionTypes.CloseMenu })
          disposables().nextFrame(() => state.buttonRef.current?.focus({ preventScroll: true }))
          break

        case Keys.Tab:
          return event.preventDefault()

        default:
          if (event.key.length === 1) {
            dispatch({ type: ActionTypes.Search, value: event.key })
            searchDisposables.setTimeout(() => dispatch({ type: ActionTypes.ClearSearch }), 350)
          }
          break
      }
    },
    [dispatch, searchDisposables, state]
  )

  let propsBag = useMemo<ItemsRenderPropArg>(
    () => ({ open: state.menuState === MenuStates.Open }),
    [state]
  )
  let propsWeControl = {
    'aria-activedescendant':
      state.activeItemIndex === null ? undefined : state.items[state.activeItemIndex]?.id,
    'aria-labelledby': state.buttonRef.current?.id,
    id,
    onKeyDown: handleKeyDown,
    role: 'menu',
    tabIndex: 0,
    ref: itemsRef,
  }
  let passthroughProps = props

  return render(
    { ...passthroughProps, ...propsWeControl },
    propsBag,
    DEFAULT_ITEMS_TAG,
    ItemsRenderFeatures,
    state.menuState === MenuStates.Open
  )
})

// ---

let DEFAULT_ITEM_TAG = Fragment
interface ItemRenderPropArg {
  active: boolean
  disabled: boolean
}
type MenuItemPropsWeControl =
  | 'id'
  | 'role'
  | 'tabIndex'
  | 'aria-disabled'
  | 'onPointerLeave'
  | 'onPointerMove'
  | 'onMouseLeave'
  | 'onMouseMove'
  | 'onFocus'

function Item<TTag extends ElementType = typeof DEFAULT_ITEM_TAG>(
  props: Props<TTag, ItemRenderPropArg, MenuItemPropsWeControl | 'className'> & {
    disabled?: boolean
    onClick?: (event: { preventDefault: Function }) => void

    // Special treatment, can either be a string or a function that resolves to a string
    className?: ((bag: ItemRenderPropArg) => string) | string
  }
) {
  let { disabled = false, className, onClick, ...passthroughProps } = props
  let [state, dispatch] = useMenuContext([Menu.name, Item.name].join('.'))
  let id = `headlessui-menu-item-${useId()}`
  let active = state.activeItemIndex !== null ? state.items[state.activeItemIndex].id === id : false

  useIsoMorphicEffect(() => {
    if (state.menuState !== MenuStates.Open) return
    if (!active) return
    let d = disposables()
    d.nextFrame(() => document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' }))
    return d.dispose
  }, [id, active, state.menuState])

  let bag = useRef<MenuItemDataRef['current']>({ disabled })

  useIsoMorphicEffect(() => {
    bag.current.disabled = disabled
  }, [bag, disabled])

  useIsoMorphicEffect(() => {
    bag.current.textValue = document.getElementById(id)?.textContent?.toLowerCase()
  }, [bag, id])

  useIsoMorphicEffect(() => {
    dispatch({ type: ActionTypes.RegisterItem, id, dataRef: bag })
    return () => dispatch({ type: ActionTypes.UnregisterItem, id })
  }, [bag, id])

  let handleClick = useCallback(
    (event: MouseEvent) => {
      if (disabled) return event.preventDefault()
      dispatch({ type: ActionTypes.CloseMenu })
      disposables().nextFrame(() => state.buttonRef.current?.focus({ preventScroll: true }))
      if (onClick) return onClick(event)
    },
    [dispatch, state.buttonRef, disabled, onClick]
  )

  let handleFocus = useCallback(() => {
    if (disabled) return dispatch({ type: ActionTypes.GoToItem, focus: Focus.Nothing })
    dispatch({ type: ActionTypes.GoToItem, focus: Focus.Specific, id })
  }, [disabled, id, dispatch])

  let handleMove = useCallback(() => {
    if (disabled) return
    if (active) return
    dispatch({ type: ActionTypes.GoToItem, focus: Focus.Specific, id })
  }, [disabled, active, id, dispatch])

  let handleLeave = useCallback(() => {
    if (disabled) return
    if (!active) return
    dispatch({ type: ActionTypes.GoToItem, focus: Focus.Nothing })
  }, [disabled, active, dispatch])

  let propsBag = useMemo<ItemRenderPropArg>(() => ({ active, disabled }), [active, disabled])
  let propsWeControl = {
    id,
    role: 'menuitem',
    tabIndex: -1,
    className: resolvePropValue(className, propsBag),
    'aria-disabled': disabled === true ? true : undefined,
    onClick: handleClick,
    onFocus: handleFocus,
    onPointerMove: handleMove,
    onMouseMove: handleMove,
    onPointerLeave: handleLeave,
    onMouseLeave: handleLeave,
  }

  return render({ ...passthroughProps, ...propsWeControl }, propsBag, DEFAULT_ITEM_TAG)
}

// ---

Menu.Button = Button
Menu.Items = Items
Menu.Item = Item
