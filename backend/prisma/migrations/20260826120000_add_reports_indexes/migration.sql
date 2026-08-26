-- Rapports et statistiques (§14, ligne 5.13, partie A5) — index nécessaires
-- avant de mesurer les temps de réponse des endpoints d'agrégation.

-- CreateIndex
CREATE INDEX `analytics_events_type_created_at_idx` ON `analytics_events`(`type`, `created_at`);

-- CreateIndex
CREATE INDEX `analytics_events_speaker_id_type_created_at_idx` ON `analytics_events`(`speaker_id`, `type`, `created_at`);

-- CreateIndex
CREATE INDEX `booking_requests_created_at_status_service_type_idx` ON `booking_requests`(`created_at`, `status`, `service_type`);

-- CreateIndex
CREATE INDEX `missions_event_date_status_idx` ON `missions`(`event_date`, `status`);
