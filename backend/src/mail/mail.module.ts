import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

@Module({
  imports: [
    // `forRootAsync` : la config (host/port/user/password) vient uniquement
    // de ConfigService (.env), jamais en dur dans le code.
    //
    // Pas de `template.adapter` ici volontairement : l'adapter Handlebars du
    // package charge `@css-inline` (binaire natif) qui entraîne à son tour
    // `mjml`/`preview-email`, deux dépendances non utilisées et truffées de
    // CVE. On compile nous-mêmes les templates avec `handlebars` directement
    // (voir MailService) et on passe le HTML déjà rendu à `sendMail()`.
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST'),
          port: config.get<number>('MAIL_PORT'),
          secure: config.get<string>('MAIL_SECURE') === 'true',
          auth: {
            user: config.get<string>('MAIL_USER'),
            pass: config.get<string>('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM'),
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
