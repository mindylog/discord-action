import * as core from '@actions/core'
import { z } from 'zod'
import { dedent } from 'ts-dedent'
import { match } from 'ts-pattern'
import { EmbedBuilder, WebhookClient } from 'discord.js'

const COLORS = {
  SUCCESS: 0x2eb67d,
  PENDING: 0xffd166,
  ERROR: 0xde005b
}

const InputSchema = z.discriminatedUnion('phase', [
  z.object({
    service_name: z.string(),
    phase: z.literal('start'),
    environment: z.string()
  }),
  z.object({
    service_name: z.string(),
    phase: z.literal('finish'),
    environment: z.string(),
    message_id: z.string()
  })
])

async function main(): Promise<void> {
  try {
    const inputs = InputSchema.parse({
      service_name: core.getInput('service_name', { required: true }),
      phase: core.getInput('phase', { required: true }),
      environment: core.getInput('environment', { required: true }),
      message_id: core.getInput('message_id')
    })
    const discordClient = new WebhookClient({
      url: getEnvVariable('DISCORD_WEBHOOK_URL')
    })

    if (inputs.phase === 'start') {
      const embed = new EmbedBuilder()
        .setTitle('배포 시작')
        .setColor(COLORS.PENDING)
      const messageResponse = await discordClient.send({
        content: buildContent(inputs),
        embeds: [embed]
      })
      core.setOutput('message_id', messageResponse.id)
      core.info(dedent(`Started message sent successfully`))
    } else if (inputs.phase === 'finish') {
      const embed = new EmbedBuilder()
        .setTitle('배포 완료')
        .setColor(COLORS.SUCCESS)
      const updatedMessageResponse = await discordClient.editMessage(
        inputs.message_id,
        {
          content: buildContent(inputs),
          embeds: [embed]
        }
      )
    }

    core.info(
      match(inputs.phase)
        .with('start', () => 'Finish message sent Successfully')
        .with('finish', () => 'Message updated Successfully')
        .otherwise(() => '')
    )
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function buildContent(inputs: z.infer<typeof InputSchema>): string {
  return dedent`
    서비스 : ${inputs.service_name}
    배포 환경 : ${inputs.environment}
    진행 상태 : ${match(inputs.phase)
      .with('start', () => ' :person_running: 배포 진행중')
      .with('finish', () => ':rocket: 배포 완료')
      .otherwise(() => '')}`
}

function getEnvVariable(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Env variable ${name} is missing.`)
  }

  return value
}

main()
