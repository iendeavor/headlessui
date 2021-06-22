<template>
  <div class="flex justify-center w-80 h-full p-12 text-secondary">
    <div class="w-full max-w-xs mx-auto">
      <div class="space-y-1">
        <Listbox v-model="active">
          <ListboxLabel class="block text-sm font-medium leading-5"
            >Assigned to</ListboxLabel
          >

          <div class="relative">
            <span class="inline-block w-full rounded shadow-sm">
              <ListboxButton as="template" #="{ open }">
                <button
                  class="relative w-full py-2 pl-3 pr-10 text-left transition duration-150 ease-in-out bg-white border border-border rounded cursor-default sm:text-sm sm:leading-5 cursor-pointer focus:border-primary focus:outline-none hover:border-disabled"
                  :class="[open && 'border-primary']"
                >
                  <span class="block truncate">{{ active.name }}</span>
                  <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-disabled">
                    <svg
                      class="w-5 h-5"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M15 7.5,10 12.5,5,7.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              </ListboxButton>
            </span>

            <div class="absolute w-full mt-4 bg-white rounded shadow-lg">
              <ListboxOptions
                class="py-1.5 overflow-auto text-base leading-6 rounded shadow-xs max-h-60 focus:outline-none sm:text-sm sm:leading-5"
              >
                <ListboxOption
                  as="template"
                  v-for="person in people"
                  :key="person.id"
                  #="{selected, active, disabled}"
                  :value="person"
                  :disabled="person.disabled"
                >
                  <li
                    :class="[
                      'relative py-1.5 pl-5 cursor-default select-none pr-9 focus:outline-none cursor-pointer text-secondary',
                      selected && 'text-primary bg-hover font-semibold',
                      active && 'bg-hover',
                      disabled && 'cursor-not-allowed text-disabled',
                      !disabled && 'hover:bg-hover',
                    ]"
                  >
                    {{ person.name }}
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </div>
          </div>
        </Listbox>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watchEffect } from 'vue'
import {
  Listbox,
  ListboxLabel,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue'

export default {
  components: { Listbox, ListboxLabel, ListboxButton, ListboxOptions, ListboxOption },
  setup(props, context) {
    let people = [
      { id: 1, name: 'Wade Cooper' },
      { id: 2, name: 'Arlene Mccoy' },
      { id: 3, name: 'Devon Webb', disabled: true },
      { id: 4, name: 'Tom Cook' },
    ]

    let active = ref(people[Math.floor(Math.random() * people.length)])
    watchEffect(() => {
      console.log(active.value)
    })

    return {
      people,
      active,
    }
  },
}
</script>
