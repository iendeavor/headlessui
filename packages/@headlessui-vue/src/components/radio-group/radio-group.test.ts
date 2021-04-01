import { defineComponent, nextTick, ref, watch } from 'vue'
import { render } from '../../test-utils/vue-testing-library'

import { RadioGroup, RadioGroupOption, RadioGroupLabel, RadioGroupDescription } from './radio-group'

import { suppressConsoleLogs } from '../../test-utils/suppress-console-logs'
import { press, Keys, shift, click } from '../../test-utils/interactions'
import {
  getByText,
  assertRadioGroupLabel,
  getRadioGroupOptions,
  assertFocusable,
  assertNotFocusable,
  assertActiveElement,
} from '../../test-utils/accessibility-assertions'
import { html } from '../../test-utils/html'

jest.mock('../../hooks/use-id')

beforeAll(() => {
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(setImmediate as any)
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(clearImmediate as any)
})

afterAll(() => jest.restoreAllMocks())

function renderTemplate(input: string | Partial<Parameters<typeof defineComponent>[0]>) {
  let defaultComponents = { RadioGroup, RadioGroupOption, RadioGroupLabel, RadioGroupDescription }

  if (typeof input === 'string') {
    return render(defineComponent({ template: input, components: defaultComponents }))
  }

  return render(
    defineComponent(
      Object.assign({}, input, {
        components: { ...defaultComponents, ...input.components },
      }) as Parameters<typeof defineComponent>[0]
    )
  )
}

describe('Safe guards', () => {
  it.each([['RadioGroupOption', RadioGroupOption]])(
    'should error when we are using a <%s /> without a parent <RadioGroup />',
    suppressConsoleLogs((name, Component) => {
      expect(() => render(Component)).toThrowError(
        `<${name} /> is missing a parent <RadioGroup /> component.`
      )
    })
  )

  it(
    'should be possible to render a RadioGroup without crashing',
    suppressConsoleLogs(async () => {
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
        `,
        setup() {
          let deliveryMethod = ref(undefined)
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      assertRadioGroupLabel({ textContent: 'Pizza Delivery' })
    })
  )

  it('should be possible to render a RadioGroup without options and without crashing', () => {
    renderTemplate({
      template: html`
        <RadioGroup v-model="deliveryMethod" />
      `,
      setup() {
        let deliveryMethod = ref(undefined)
        return { deliveryMethod }
      },
    })
  })
})

describe('Rendering', () => {
  it('should be possible to render a RadioGroup, where the first element is tabbable', async () => {
    renderTemplate({
      template: html`
        <RadioGroup v-model="deliveryMethod">
          <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
          <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
          <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
          <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
        </RadioGroup>
      `,
      setup() {
        let deliveryMethod = ref(undefined)
        return { deliveryMethod }
      },
    })

    await new Promise<void>(nextTick)

    expect(getRadioGroupOptions()).toHaveLength(3)

    assertFocusable(getByText('Pickup'))
    assertNotFocusable(getByText('Home delivery'))
    assertNotFocusable(getByText('Dine in'))
  })

  it('should be possible to render a RadioGroup with an active value', async () => {
    renderTemplate({
      template: html`
        <RadioGroup v-model="deliveryMethod">
          <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
          <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
          <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
          <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
        </RadioGroup>
      `,
      setup() {
        let deliveryMethod = ref('home-delivery')
        return { deliveryMethod }
      },
    })

    expect(getRadioGroupOptions()).toHaveLength(3)

    assertNotFocusable(getByText('Pickup'))
    assertFocusable(getByText('Home delivery'))
    assertNotFocusable(getByText('Dine in'))
  })

  it('should guarantee the radio option order after a few unmounts', async () => {
    renderTemplate({
      template: html`
        <button @click="showFirst = !showFirst">Toggle</button>
        <RadioGroup v-model="deliveryMethod">
          <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
          <RadioGroupOption v-if="showFirst" value="pickup">Pickup</RadioGroupOption>
          <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
          <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
        </RadioGroup>
      `,
      setup() {
        let showFirst = ref(false)
        let deliveryMethod = ref(undefined)
        return { showFirst, deliveryMethod }
      },
    })

    await new Promise<void>(nextTick)

    await click(getByText('Toggle')) // Render the pickup again

    await press(Keys.Tab) // Focus first element
    assertActiveElement(getByText('Pickup'))

    await press(Keys.ArrowUp) // Loop around
    assertActiveElement(getByText('Dine in'))

    await press(Keys.ArrowUp) // Up again
    assertActiveElement(getByText('Home delivery'))
  })
})

describe('Keyboard interactions', () => {
  describe('`Tab` key', () => {
    it('should be possible to tab to the first item', async () => {
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
        `,
        setup() {
          let deliveryMethod = ref()
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))
    })

    it('should not change the selected element on focus', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      expect(changeFn).toHaveBeenCalledTimes(0)
    })

    it('should be possible to tab to the active item', async () => {
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
        `,
        setup() {
          let deliveryMethod = ref('home-delivery')
          return { deliveryMethod }
        },
      })

      await press(Keys.Tab)

      assertActiveElement(getByText('Home delivery'))
    })

    it('should not change the selected element on focus (when selecting the active item)', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
        `,
        setup() {
          let deliveryMethod = ref('home-delivery')
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      await press(Keys.Tab)

      assertActiveElement(getByText('Home delivery'))

      expect(changeFn).toHaveBeenCalledTimes(0)
    })

    it('should be possible to tab out of the radio group (no selected value)', async () => {
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          return { deliveryMethod }
        },
      })

      await press(Keys.Tab)
      assertActiveElement(getByText('Before'))

      await press(Keys.Tab)
      assertActiveElement(getByText('Pickup'))

      await press(Keys.Tab)
      assertActiveElement(getByText('After'))
    })

    it('should be possible to tab out of the radio group (selected value)', async () => {
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref('home-delivery')
          return { deliveryMethod }
        },
      })

      await press(Keys.Tab)
      assertActiveElement(getByText('Before'))

      await press(Keys.Tab)
      assertActiveElement(getByText('Home delivery'))

      await press(Keys.Tab)
      assertActiveElement(getByText('After'))
    })
  })

  describe('`Shift+Tab` key', () => {
    it('should be possible to tab to the first item', async () => {
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      getByText('After')?.focus()

      await press(shift(Keys.Tab))

      assertActiveElement(getByText('Pickup'))
    })

    it('should not change the selected element on focus', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      getByText('After')?.focus()

      await press(shift(Keys.Tab))

      assertActiveElement(getByText('Pickup'))

      expect(changeFn).toHaveBeenCalledTimes(0)
    })

    it('should be possible to tab to the active item', async () => {
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref('home-delivery')
          return { deliveryMethod }
        },
      })

      getByText('After')?.focus()

      await press(shift(Keys.Tab))

      assertActiveElement(getByText('Home delivery'))
    })

    it('should not change the selected element on focus (when selecting the active item)', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref('home-delivery')
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      getByText('After')?.focus()

      await press(shift(Keys.Tab))

      assertActiveElement(getByText('Home delivery'))

      expect(changeFn).toHaveBeenCalledTimes(0)
    })

    it('should be possible to tab out of the radio group (no selected value)', async () => {
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      getByText('After')?.focus()

      await press(shift(Keys.Tab))
      assertActiveElement(getByText('Pickup'))

      await press(shift(Keys.Tab))
      assertActiveElement(getByText('Before'))
    })

    it('should be possible to tab out of the radio group (selected value)', async () => {
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref('home-delivery')
          return { deliveryMethod }
        },
      })

      getByText('After')?.focus()

      await press(shift(Keys.Tab))
      assertActiveElement(getByText('Home delivery'))

      await press(shift(Keys.Tab))
      assertActiveElement(getByText('Before'))
    })
  })

  describe('`ArrowLeft` key', () => {
    it('should go to the previous item when pressing the ArrowLeft key', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      await new Promise<void>(nextTick)

      // Focus the "Before" button
      await press(Keys.Tab)

      // Focus the RadioGroup
      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      await press(Keys.ArrowLeft) // Loop around
      assertActiveElement(getByText('Dine in'))

      await press(Keys.ArrowLeft)
      assertActiveElement(getByText('Home delivery'))

      expect(changeFn).toHaveBeenCalledTimes(2)
      expect(changeFn).toHaveBeenNthCalledWith(1, 'dine-in')
      expect(changeFn).toHaveBeenNthCalledWith(2, 'home-delivery')
    })
  })

  describe('`ArrowUp` key', () => {
    it('should go to the previous item when pressing the ArrowUp key', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      // Focus the "Before" button
      await press(Keys.Tab)

      // Focus the RadioGroup
      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      await press(Keys.ArrowUp) // Loop around
      assertActiveElement(getByText('Dine in'))

      await press(Keys.ArrowUp)
      assertActiveElement(getByText('Home delivery'))

      expect(changeFn).toHaveBeenCalledTimes(2)
      expect(changeFn).toHaveBeenNthCalledWith(1, 'dine-in')
      expect(changeFn).toHaveBeenNthCalledWith(2, 'home-delivery')
    })
  })

  describe('`ArrowRight` key', () => {
    it('should go to the next item when pressing the ArrowRight key', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      // Focus the "Before" button
      await press(Keys.Tab)

      // Focus the RadioGroup
      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      await press(Keys.ArrowRight)
      assertActiveElement(getByText('Home delivery'))

      await press(Keys.ArrowRight)
      assertActiveElement(getByText('Dine in'))

      await press(Keys.ArrowRight) // Loop around
      assertActiveElement(getByText('Pickup'))

      expect(changeFn).toHaveBeenCalledTimes(3)
      expect(changeFn).toHaveBeenNthCalledWith(1, 'home-delivery')
      expect(changeFn).toHaveBeenNthCalledWith(2, 'dine-in')
      expect(changeFn).toHaveBeenNthCalledWith(3, 'pickup')
    })
  })

  describe('`ArrowDown` key', () => {
    it('should go to the next item when pressing the ArrowDown key', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      // Focus the "Before" button
      await press(Keys.Tab)

      // Focus the RadioGroup
      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      await press(Keys.ArrowDown)
      assertActiveElement(getByText('Home delivery'))

      await press(Keys.ArrowDown)
      assertActiveElement(getByText('Dine in'))

      await press(Keys.ArrowDown) // Loop around
      assertActiveElement(getByText('Pickup'))

      expect(changeFn).toHaveBeenCalledTimes(3)
      expect(changeFn).toHaveBeenNthCalledWith(1, 'home-delivery')
      expect(changeFn).toHaveBeenNthCalledWith(2, 'dine-in')
      expect(changeFn).toHaveBeenNthCalledWith(3, 'pickup')
    })
  })

  describe('`Space` key', () => {
    it('should select the current option when pressing space', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      // Focus the "Before" button
      await press(Keys.Tab)

      // Focus the RadioGroup
      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      await press(Keys.Space)
      assertActiveElement(getByText('Pickup'))

      expect(changeFn).toHaveBeenCalledTimes(1)
      expect(changeFn).toHaveBeenNthCalledWith(1, 'pickup')
    })

    it('should select the current option only once when pressing space', async () => {
      let changeFn = jest.fn()
      renderTemplate({
        template: html`
          <button>Before</button>
          <RadioGroup v-model="deliveryMethod">
            <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
            <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
            <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
            <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
          </RadioGroup>
          <button>After</button>
        `,
        setup() {
          let deliveryMethod = ref()
          watch([deliveryMethod], () => changeFn(deliveryMethod.value))
          return { deliveryMethod }
        },
      })

      // Focus the "Before" button
      await press(Keys.Tab)

      // Focus the RadioGroup
      await press(Keys.Tab)

      assertActiveElement(getByText('Pickup'))

      await press(Keys.Space)
      await press(Keys.Space)
      await press(Keys.Space)
      await press(Keys.Space)
      await press(Keys.Space)
      assertActiveElement(getByText('Pickup'))

      expect(changeFn).toHaveBeenCalledTimes(1)
      expect(changeFn).toHaveBeenNthCalledWith(1, 'pickup')
    })
  })
})

describe('Mouse interactions', () => {
  it('should be possible to change the current radio group value when clicking on a radio option', async () => {
    let changeFn = jest.fn()
    renderTemplate({
      template: html`
        <button>Before</button>
        <RadioGroup v-model="deliveryMethod">
          <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
          <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
          <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
          <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
        </RadioGroup>
        <button>After</button>
      `,
      setup() {
        let deliveryMethod = ref()
        watch([deliveryMethod], () => changeFn(deliveryMethod.value))
        return { deliveryMethod }
      },
    })

    await click(getByText('Home delivery'))

    assertActiveElement(getByText('Home delivery'))

    expect(changeFn).toHaveBeenNthCalledWith(1, 'home-delivery')
  })

  it('should be a no-op when clicking on the same item', async () => {
    let changeFn = jest.fn()
    renderTemplate({
      template: html`
        <button>Before</button>
        <RadioGroup v-model="deliveryMethod">
          <RadioGroupLabel>Pizza Delivery</RadioGroupLabel>
          <RadioGroupOption value="pickup">Pickup</RadioGroupOption>
          <RadioGroupOption value="home-delivery">Home delivery</RadioGroupOption>
          <RadioGroupOption value="dine-in">Dine in</RadioGroupOption>
        </RadioGroup>
        <button>After</button>
      `,
      setup() {
        let deliveryMethod = ref()
        watch([deliveryMethod], () => changeFn(deliveryMethod.value))
        return { deliveryMethod }
      },
    })

    await click(getByText('Home delivery'))
    await click(getByText('Home delivery'))
    await click(getByText('Home delivery'))
    await click(getByText('Home delivery'))

    assertActiveElement(getByText('Home delivery'))

    expect(changeFn).toHaveBeenCalledTimes(1)
  })
})
