<script setup lang="ts">
import { darkTheme } from 'naive-ui'
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DeleteFilled, ArrowDropDownRound, CheckRound } from '@vicons/material'
import { useStorage } from '@vueuse/core'
import { useBreakpoints } from '@vueuse/core'

const breakpoints = useBreakpoints({
  mobile: 0, // optional
  desktop: 1280,
})

const mobile = breakpoints.isSmaller('desktop')

const desktop = breakpoints.isGreaterOrEqual('desktop')

const geminiApiKey = useStorage<string>('geminiApiKey', '')

async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string)?.split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

const file = ref<File | null>(null)

const imgUrl = computed(() => {
  if (!file.value) return ''
  return URL.createObjectURL(file.value)
})

type StringField = {
  type: 'string',
  name: string
}

type TableField = {
  type: 'table',
  name: string,
  columns: StringField[]
}

type Field = StringField | TableField

const result = ref<any>({
  invoice_no: "123456",
  date: "2021-01-01",
  items: [
    { name: "item1", price: 100 },
    { name: "item2", price: 200 },
  ]
})

const schemas = useStorage('schemas', [{
  name: 'Default',
  fields: [] as Field[]
}])

const activeSchema = ref<typeof schemas.value[0]>(schemas.value[0])

function addSchema(name: string) {
  schemas.value.push({
    name,
    fields: []
  })

  activeSchema.value = schemas.value[schemas.value.length - 1]
}

function deleteSchema(index: number) {
  if (schemas.value.length === 1) {
    schemas.value[0].name = 'Default'
    schemas.value[0].fields = []
    return
  }

  if (activeSchema.value === schemas.value[index]) {
    activeSchema.value = schemas.value[0]
  }

  schemas.value.splice(index, 1)
}


function addStringField() {
  activeSchema.value.fields.push({
    type: 'string',
    name: ''
  })
}

function addTableField() {
  activeSchema.value.fields.push({
    type: 'table',
    name: '',
    columns: []
  })
}

function deleteField(index: number) {
  activeSchema.value.fields.splice(index, 1)
}

const cost = ref(0)

const running = ref(false)

async function run() {
  if (file.value === null) {
    return
  }

  running.value = true

  cost.value = 0

  const genAI = new GoogleGenerativeAI(geminiApiKey.value);
  // The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  function getSchema(schema: Field[]): string {
    return `{${schema.map((field) => {
      if (field.type === 'string') {
        return `"${field.name}": string`
      } else {
        return `"${field.name}": ${getSchema(field.columns)}[]`
      }
    }).join('\n')}}`
  }

  const schemaPrompt = getSchema(activeSchema.value.fields)

  const promptPrefix = "Express image in json format without markdown schema. Use the following schema: \n"
  const prompt = promptPrefix + schemaPrompt

  const filePart = await fileToGenerativePart(file.value)
  const generatedContent = await model.generateContent([prompt, filePart as any]);
  const response = await generatedContent.response;
  const text = response.text().replace(/^[^{]*|[^}]*$/g, '');

  const usageMetadata = response.usageMetadata
  cost.value = (usageMetadata?.candidatesTokenCount || 0) * 1.05 * 1e-6
    + (usageMetadata?.promptTokenCount || 0) * 0.35 * 1e-6

  result.value = JSON.parse(text)

  running.value = false
}

</script>

<template lang="pug">
n-config-provider(:theme="darkTheme")
  n-layout(style="height: 100vh;" content-style='display: flex; flex-direction: column;')
    n-layout-header
      n-space(:align="'center'" :justify="'space-between'" style="height: 100%; padding: 0 12px;" :vertical="mobile")
        n-space(:align="'center'")
          div(v-if="desktop" style="font-size: x-large;") Document AI

          n-popover(:show-arrow="false" trigger="click" placement="bottom-start")
            template(#trigger)
              n-button
                n-space(:align="'center'" justify="space-between" style="width: 200px;")
                  div {{ activeSchema.name }}
                  n-icon(:size="24") #[ArrowDropDownRound]
            n-space(vertical)
              n-space(v-for="schema, i in schemas" :align="'center'" :justify="'space-between'" size="small")
                n-input(v-model:value="schema.name")
                n-button(type="error" size="small" @click="deleteSchema(i)") #[n-icon #[DeleteFilled]]
                n-button(type="primary" size="small" :disabled="schema == activeSchema" @click="activeSchema = schema") #[n-icon #[CheckRound]]
              n-button(type="primary" size="small" block @click="addSchema('')") Add


          n-popover
            template(#trigger)
              n-button(type="primary") Setting
            n-space(vertical)
              n-space(:align="'center'")
                div Gemini API Key
                n-input(v-model:value="geminiApiKey" placeholder="API Key" size="small" style="width: 400px;" type="password")
        n-space(:align="'center'")
          div(style="font-family: monospace;") USD {{ cost.toFixed(4) }}
          n-button(type="primary" @click="run" :loading="running") Run
    n-layout-content
      n-split(:min="0.1" :max="0.9" :direction="mobile ? 'vertical' : 'horizontal'")
        template(#1)
          n-upload(
            style="height: 100%;"
            trigger-style="height: 100%;"
            @before-upload="(data) => { file = data?.file?.file }"
            :show-file-list="false"
          )
            n-upload-dragger
              p(v-if="!imgUrl") Drag file here to upload
              n-scrollbar(v-else)
                img(:src="imgUrl" style="max-width: 100%; max-height: 100%;")
        template(#2)
          n-space(vertical size="large")
            template(v-for="(field, index) in activeSchema.fields" :key="index")
              div(v-if="field.type === 'string'" style="display: flex; align-items: center;")
                n-input(v-model:value="field.name" placeholder="Field Name" style="width: 300px;" size="small")
                div(style="flex-grow: 2;") : {{ result?.[field.name] }}
                n-button(type="error" @click="deleteField(index)" circle size="tiny") 
                  n-icon
                    DeleteFilled

              div(v-else-if="field.type === 'table'")
                div(style="display: flex; align-items: center;")
                  n-input(v-model:value="field.name" placeholder="Table Name" size="small" style="flex-grow: 2;")
                  n-button(type="error" @click="deleteField(index)" circle size="tiny")
                    n-icon
                      DeleteFilled
                n-table(size="small")
                  thead
                    tr
                      th(v-for="(column, columnIndex) in field.columns" :key="columnIndex")
                        n-input(v-model:value="column.name" placeholder="Column Name" size="small")
                          template(#suffix)
                            n-button(type="error" @click="field.columns.splice(columnIndex, 1)" size="tiny") 
                              n-icon
                                DeleteFilled
                      th
                        n-button(type="primary" @click="field.columns.push({ type: 'string', name: '' })" size="small") +
                  tbody
                    tr(v-for="(item, itemIndex) in result?.[field.name]" :key="itemIndex")
                      td(v-for="(column, columnIndex) in field.columns" :key="columnIndex")
                        span {{ item[column.name] }}


            n-space(justify="center")
              n-button(type="primary" @click="addStringField") Add String Field
              n-button(type="primary" @click="addTableField") Add Table Field
</template>

<style scoped>
.n-layout-header {
  padding: 8px 0;
}

.n-layout-content {
  padding: 12px;
  flex-grow: 2;
}

.n-upload-dragger {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.n-grid>div {
  height: 100%;
  overflow: hidden;
}
</style>
