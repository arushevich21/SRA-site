--
-- PostgreSQL database dump
--

\restrict NGcTjxW3e6Ft3QW9CWnHiq5ZeyjDD3Lj6eTHyHWGEtKsPhJtYbYrf8HqpJkufVc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: driver_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_tier AS ENUM (
    'gold',
    'silver'
);


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: acc_cars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_cars (
    car_model_id integer NOT NULL,
    name text NOT NULL,
    car_group text NOT NULL,
    year integer,
    brand_logo_url text
);


--
-- Name: acc_hotlap_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_hotlap_leaderboard (
    track_key text NOT NULL,
    steam_id text NOT NULL,
    driver_name text NOT NULL,
    car_model text,
    best_lap_ms integer NOT NULL,
    sectors_ms jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    car_model_id integer NOT NULL,
    is_wet boolean DEFAULT false NOT NULL,
    board_scope text DEFAULT 'persistent'::text NOT NULL,
    season text DEFAULT ''::text NOT NULL,
    total_laps integer DEFAULT 0 NOT NULL,
    total_valid_laps integer DEFAULT 0 NOT NULL,
    car_group text
);


--
-- Name: acc_hotlap_refresh_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_hotlap_refresh_state (
    id text DEFAULT 'global'::text NOT NULL,
    refresh_started_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acc_hotstint_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_hotstint_leaderboard (
    track_key text NOT NULL,
    car_group text NOT NULL,
    steam_id text NOT NULL,
    board_scope text DEFAULT 'persistent'::text NOT NULL,
    season text DEFAULT ''::text NOT NULL,
    is_wet boolean DEFAULT false NOT NULL,
    qualifying boolean DEFAULT false NOT NULL,
    driver_name text NOT NULL,
    car_model text,
    car_model_id integer NOT NULL,
    best_stint_ms integer NOT NULL,
    sectors_ms jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_laps integer DEFAULT 0 NOT NULL,
    total_valid_laps integer DEFAULT 0 NOT NULL
);


--
-- Name: acc_processed_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_processed_sessions (
    session_url text NOT NULL,
    track text NOT NULL,
    session_type text NOT NULL,
    session_date text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acc_race_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_race_sessions (
    session_key text NOT NULL,
    event_key text NOT NULL,
    session_type text NOT NULL,
    track_key text NOT NULL,
    server_name text,
    session_date timestamp with time zone NOT NULL,
    session_file text,
    meta_data text,
    championship_id text,
    season_id text,
    is_wet_session boolean DEFAULT false NOT NULL,
    best_lap_ms integer,
    results jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acc_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_tracks (
    track_key text NOT NULL,
    display_name text NOT NULL,
    splash_art_url text,
    country text,
    location text
);


--
-- Name: acevo_hotlap_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_hotlap_cache (
    track_key text NOT NULL,
    entries jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_session_date timestamp with time zone
);


--
-- Name: acevo_hotlap_cache_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_hotlap_cache_v2 (
    layout_key text NOT NULL,
    entries jsonb NOT NULL,
    last_session_date text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acevo_hotlap_refresh_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_hotlap_refresh_state (
    id text DEFAULT 'global'::text NOT NULL,
    last_session_date timestamp with time zone,
    refresh_started_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acevo_processed_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_processed_sessions (
    session_url text NOT NULL,
    track text NOT NULL,
    session_type text NOT NULL,
    session_date text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acevo_race_results_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_race_results_cache (
    track_key text NOT NULL,
    session_type text NOT NULL,
    session_result jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acevo_round_points_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_round_points_cache (
    track_key text NOT NULL,
    race_position_points jsonb DEFAULT '{}'::jsonb NOT NULL,
    fastest_lap_steam_id text,
    pole_steam_id text,
    race_session_date timestamp with time zone,
    qualify_session_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pole_lap_ms bigint
);


--
-- Name: acevo_round_points_cache_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acevo_round_points_cache_v2 (
    layout_key text NOT NULL,
    race_position_points jsonb,
    fastest_lap_steam_id text,
    pole_steam_id text,
    pole_lap_ms integer,
    race_session_date timestamp with time zone,
    qualify_session_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bop_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bop_config (
    id text DEFAULT 'default'::text NOT NULL,
    bop_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'Default'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bop_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bop_entries (
    track text NOT NULL,
    car_model integer NOT NULL,
    ballast_kg integer DEFAULT 0 NOT NULL,
    restrictor integer DEFAULT 0 NOT NULL
);


--
-- Name: bot_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: championship_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.championship_rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    championship_id uuid NOT NULL,
    round integer NOT NULL,
    track text NOT NULL,
    race_length text DEFAULT ''::text NOT NULL,
    starts_at text,
    emperor_track text,
    emperor_raw_track_name text,
    hotlap_released boolean DEFAULT false NOT NULL
);


--
-- Name: championships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.championships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    game text NOT NULL,
    title text NOT NULL,
    class_tag text NOT NULL,
    format_tag text,
    event_type text DEFAULT 'championship'::text NOT NULL,
    classes text[] DEFAULT '{}'::text[] NOT NULL,
    logo_url text,
    race_format text DEFAULT ''::text NOT NULL,
    race_days text,
    rules_bullets text[] DEFAULT '{}'::text[] NOT NULL,
    discord_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    results_url text,
    results_label text,
    emperor_championship_id text,
    simgrid_id integer,
    standings_key text,
    registration_key text,
    registration_season text,
    registration_open boolean DEFAULT false NOT NULL,
    max_team_size integer,
    allowed_cars text[],
    teaser_only boolean DEFAULT false NOT NULL,
    concluded boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: classification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification (
    id bigint NOT NULL,
    series text DEFAULT 'GT3'::text NOT NULL,
    season integer NOT NULL,
    discord_id text NOT NULL,
    driver_id uuid,
    steam_id text,
    has_signup boolean DEFAULT false NOT NULL,
    has_account boolean DEFAULT false NOT NULL,
    has_hotstint boolean DEFAULT false NOT NULL,
    eligible boolean GENERATED ALWAYS AS ((has_signup AND has_account AND has_hotstint)) STORED,
    hotstint_ms integer,
    num_laps integer,
    is_returning boolean DEFAULT false NOT NULL,
    srating_ordinal numeric,
    score_detail jsonb,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: classification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.classification ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.classification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.divisions (
    id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: driver_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_ratings (
    player_id text NOT NULL,
    driver_id uuid,
    engine text DEFAULT 'v2-openskill'::text NOT NULL,
    os_mu numeric,
    os_sigma numeric,
    os_ordinal numeric,
    pace numeric,
    num_races integer,
    last_season integer,
    detail jsonb,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    composite numeric,
    pace_pct numeric,
    os_pct numeric
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    steam_id text,
    discord_id text,
    simgrid_driver_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    avatar_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    division_id integer,
    tier public.driver_tier,
    steam_verified boolean DEFAULT false NOT NULL,
    first_name text,
    last_name text,
    driver_number integer,
    is_sralien boolean DEFAULT false NOT NULL,
    short_name character varying(3),
    country character(2),
    source_id integer,
    email text,
    pronoun text,
    phonetic_first_name text,
    phonetic_last_name text,
    timezone_offset text,
    discord_username text,
    discord_joined_datetime timestamp with time zone,
    discord_roles_new jsonb,
    discord_last_updated timestamp with time zone,
    preserve_driver_number boolean,
    allow_gt3_team_series_solo_registration boolean,
    discord_mention_laptime_updates boolean,
    is_sponsor boolean,
    is_champion boolean DEFAULT false NOT NULL,
    CONSTRAINT drivers_country_len CHECK (((country IS NULL) OR (char_length(country) = 2))),
    CONSTRAINT drivers_number_range CHECK (((driver_number IS NULL) OR ((driver_number >= 2) AND (driver_number <= 999)))),
    CONSTRAINT drivers_short_name_len CHECK (((short_name IS NULL) OR (char_length((short_name)::text) = 3)))
);


--
-- Name: ref_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_times (
    track text NOT NULL,
    season integer DEFAULT 0 NOT NULL,
    engine text DEFAULT 'v2'::text NOT NULL,
    ref_time_ms numeric,
    pool_size integer,
    n_laps integer,
    as_of date,
    half_life_months numeric,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: registration_drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registration_drivers (
    registration_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    driver_category integer DEFAULT 1 NOT NULL,
    slot integer DEFAULT 0 NOT NULL
);


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    series text NOT NULL,
    season text NOT NULL,
    championship_key text NOT NULL,
    division_id integer,
    team_id uuid,
    car_model_id integer,
    race_number integer,
    entry_class text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: srating_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.srating_history (
    id bigint NOT NULL,
    series text DEFAULT 'GT3'::text NOT NULL,
    season integer NOT NULL,
    event integer NOT NULL,
    track text,
    event_date date,
    driver_id uuid,
    player_id text NOT NULL,
    finish_position integer,
    pace_norm numeric,
    laps integer,
    pace numeric,
    openskill numeric,
    composite numeric,
    excluded boolean DEFAULT false NOT NULL,
    exclude_reason text,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: srating_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.srating_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.srating_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: standings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standings (
    standings_key text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    driver_category integer DEFAULT 1 NOT NULL
);


--
-- Name: team_registration_drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_registration_drivers (
    registration_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    driver_category integer DEFAULT 1 NOT NULL,
    slot integer DEFAULT 0 NOT NULL
);


--
-- Name: team_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_name text NOT NULL,
    season text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    championship_key text NOT NULL,
    division_id integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    entry_class text,
    race_number integer,
    car_model_id integer
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    series text NOT NULL,
    season text NOT NULL,
    name text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: track_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_layouts (
    layout_key text NOT NULL,
    base_track_key text NOT NULL,
    game text NOT NULL,
    layout_name text,
    display_name text NOT NULL,
    map_url text
);


--
-- Name: tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracks (
    base_track_key text NOT NULL,
    display_name text NOT NULL,
    splash_art_url text,
    country text,
    location text
);


--
-- Name: acc_cars acc_cars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_cars
    ADD CONSTRAINT acc_cars_pkey PRIMARY KEY (car_model_id);


--
-- Name: acc_hotlap_leaderboard acc_hotlap_leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_hotlap_leaderboard
    ADD CONSTRAINT acc_hotlap_leaderboard_pkey PRIMARY KEY (track_key, car_model_id, steam_id, board_scope, season, is_wet);


--
-- Name: acc_hotlap_refresh_state acc_hotlap_refresh_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_hotlap_refresh_state
    ADD CONSTRAINT acc_hotlap_refresh_state_pkey PRIMARY KEY (id);


--
-- Name: acc_hotstint_leaderboard acc_hotstint_leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_hotstint_leaderboard
    ADD CONSTRAINT acc_hotstint_leaderboard_pkey PRIMARY KEY (track_key, car_model_id, steam_id, board_scope, season, is_wet, qualifying);


--
-- Name: acc_processed_sessions acc_processed_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_processed_sessions
    ADD CONSTRAINT acc_processed_sessions_pkey PRIMARY KEY (session_url);


--
-- Name: acc_race_sessions acc_race_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_race_sessions
    ADD CONSTRAINT acc_race_sessions_pkey PRIMARY KEY (session_key);


--
-- Name: acc_tracks acc_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_tracks
    ADD CONSTRAINT acc_tracks_pkey PRIMARY KEY (track_key);


--
-- Name: acevo_hotlap_cache acevo_hotlap_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_hotlap_cache
    ADD CONSTRAINT acevo_hotlap_cache_pkey PRIMARY KEY (track_key);


--
-- Name: acevo_hotlap_cache_v2 acevo_hotlap_cache_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_hotlap_cache_v2
    ADD CONSTRAINT acevo_hotlap_cache_v2_pkey PRIMARY KEY (layout_key);


--
-- Name: acevo_hotlap_refresh_state acevo_hotlap_refresh_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_hotlap_refresh_state
    ADD CONSTRAINT acevo_hotlap_refresh_state_pkey PRIMARY KEY (id);


--
-- Name: acevo_processed_sessions acevo_processed_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_processed_sessions
    ADD CONSTRAINT acevo_processed_sessions_pkey PRIMARY KEY (session_url);


--
-- Name: acevo_race_results_cache acevo_race_results_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_race_results_cache
    ADD CONSTRAINT acevo_race_results_cache_pkey PRIMARY KEY (track_key, session_type);


--
-- Name: acevo_round_points_cache acevo_round_points_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_round_points_cache
    ADD CONSTRAINT acevo_round_points_cache_pkey PRIMARY KEY (track_key);


--
-- Name: acevo_round_points_cache_v2 acevo_round_points_cache_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_round_points_cache_v2
    ADD CONSTRAINT acevo_round_points_cache_v2_pkey PRIMARY KEY (layout_key);


--
-- Name: bop_config bop_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bop_config
    ADD CONSTRAINT bop_config_pkey PRIMARY KEY (id);


--
-- Name: bop_entries bop_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bop_entries
    ADD CONSTRAINT bop_entries_pkey PRIMARY KEY (track, car_model);


--
-- Name: bot_jobs bot_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_jobs
    ADD CONSTRAINT bot_jobs_pkey PRIMARY KEY (id);


--
-- Name: championship_rounds championship_rounds_championship_id_round_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.championship_rounds
    ADD CONSTRAINT championship_rounds_championship_id_round_key UNIQUE (championship_id, round);


--
-- Name: championship_rounds championship_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.championship_rounds
    ADD CONSTRAINT championship_rounds_pkey PRIMARY KEY (id);


--
-- Name: championships championships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.championships
    ADD CONSTRAINT championships_pkey PRIMARY KEY (id);


--
-- Name: championships championships_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.championships
    ADD CONSTRAINT championships_slug_key UNIQUE (slug);


--
-- Name: classification classification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification
    ADD CONSTRAINT classification_pkey PRIMARY KEY (id);


--
-- Name: classification classification_series_season_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification
    ADD CONSTRAINT classification_series_season_discord_id_key UNIQUE (series, season, discord_id);


--
-- Name: divisions divisions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT divisions_name_key UNIQUE (name);


--
-- Name: divisions divisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT divisions_pkey PRIMARY KEY (id);


--
-- Name: driver_ratings driver_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_ratings
    ADD CONSTRAINT driver_ratings_pkey PRIMARY KEY (player_id, engine);


--
-- Name: drivers drivers_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_discord_id_key UNIQUE (discord_id);


--
-- Name: drivers drivers_driver_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_driver_number_key UNIQUE (driver_number);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_simgrid_driver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_simgrid_driver_id_key UNIQUE (simgrid_driver_id);


--
-- Name: drivers drivers_steam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_steam_id_key UNIQUE (steam_id);


--
-- Name: ref_times ref_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_times
    ADD CONSTRAINT ref_times_pkey PRIMARY KEY (track, season, engine);


--
-- Name: registration_drivers registration_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_drivers
    ADD CONSTRAINT registration_drivers_pkey PRIMARY KEY (registration_id, driver_id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: srating_history srating_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.srating_history
    ADD CONSTRAINT srating_history_pkey PRIMARY KEY (id);


--
-- Name: srating_history srating_history_series_season_event_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.srating_history
    ADD CONSTRAINT srating_history_series_season_event_player_id_key UNIQUE (series, season, event, player_id);


--
-- Name: standings standings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standings
    ADD CONSTRAINT standings_pkey PRIMARY KEY (standings_key);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, driver_id);


--
-- Name: team_registration_drivers team_registration_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_registration_drivers
    ADD CONSTRAINT team_registration_drivers_pkey PRIMARY KEY (registration_id, driver_id);


--
-- Name: team_registrations team_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_registrations
    ADD CONSTRAINT team_registrations_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: track_layouts track_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_layouts
    ADD CONSTRAINT track_layouts_pkey PRIMARY KEY (layout_key);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (base_track_key);


--
-- Name: acc_hotlap_leaderboard_track_car_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_hotlap_leaderboard_track_car_rank_idx ON public.acc_hotlap_leaderboard USING btree (track_key, car_model_id, best_lap_ms);


--
-- Name: acc_hotstint_board_class_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_hotstint_board_class_rank_idx ON public.acc_hotstint_leaderboard USING btree (board_scope, season, is_wet, qualifying, track_key, car_group, best_stint_ms);


--
-- Name: acc_hotstint_track_car_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_hotstint_track_car_rank_idx ON public.acc_hotstint_leaderboard USING btree (track_key, car_model_id, best_stint_ms);


--
-- Name: acc_race_sessions_event_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_race_sessions_event_key_idx ON public.acc_race_sessions USING btree (event_key, session_type);


--
-- Name: acc_race_sessions_session_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_race_sessions_session_date_idx ON public.acc_race_sessions USING btree (session_date DESC);


--
-- Name: bot_jobs_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bot_jobs_pending ON public.bot_jobs USING btree (created_at) WHERE (status = 'pending'::text);


--
-- Name: championship_rounds_championship_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX championship_rounds_championship_id_idx ON public.championship_rounds USING btree (championship_id);


--
-- Name: classification_driver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classification_driver_id_idx ON public.classification USING btree (driver_id);


--
-- Name: classification_season_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classification_season_idx ON public.classification USING btree (series, season);


--
-- Name: classification_steam_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classification_steam_id_idx ON public.classification USING btree (steam_id);


--
-- Name: driver_ratings_driver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_ratings_driver_id_idx ON public.driver_ratings USING btree (driver_id);


--
-- Name: drivers_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX drivers_source_id_idx ON public.drivers USING btree (source_id);


--
-- Name: registrations_champ; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registrations_champ ON public.registrations USING btree (championship_key, season);


--
-- Name: srating_history_driver_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX srating_history_driver_idx ON public.srating_history USING btree (driver_id);


--
-- Name: srating_history_excluded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX srating_history_excluded_idx ON public.srating_history USING btree (excluded) WHERE excluded;


--
-- Name: srating_history_player_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX srating_history_player_idx ON public.srating_history USING btree (player_id);


--
-- Name: srating_history_season_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX srating_history_season_idx ON public.srating_history USING btree (series, season, event);


--
-- Name: team_reg_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX team_reg_name_unique ON public.team_registrations USING btree (championship_key, season, lower(team_name));


--
-- Name: teams_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teams_name_unique ON public.teams USING btree (series, season, lower(name));


--
-- Name: track_layouts_base_track_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX track_layouts_base_track_idx ON public.track_layouts USING btree (base_track_key);


--
-- Name: track_layouts_game_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX track_layouts_game_idx ON public.track_layouts USING btree (game);


--
-- Name: acc_race_sessions acc_race_sessions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER acc_race_sessions_set_updated_at BEFORE UPDATE ON public.acc_race_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: championships championships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER championships_updated_at BEFORE UPDATE ON public.championships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: drivers drivers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: settings settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: team_registrations team_registrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER team_registrations_updated_at BEFORE UPDATE ON public.team_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: acc_hotlap_leaderboard acc_hotlap_leaderboard_car_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_hotlap_leaderboard
    ADD CONSTRAINT acc_hotlap_leaderboard_car_fk FOREIGN KEY (car_model_id) REFERENCES public.acc_cars(car_model_id);


--
-- Name: acc_hotlap_leaderboard acc_hotlap_leaderboard_track_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_hotlap_leaderboard
    ADD CONSTRAINT acc_hotlap_leaderboard_track_key_fkey FOREIGN KEY (track_key) REFERENCES public.acc_tracks(track_key);


--
-- Name: acc_hotstint_leaderboard acc_hotstint_leaderboard_car_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_hotstint_leaderboard
    ADD CONSTRAINT acc_hotstint_leaderboard_car_fk FOREIGN KEY (car_model_id) REFERENCES public.acc_cars(car_model_id);


--
-- Name: acc_race_sessions acc_race_sessions_track_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_race_sessions
    ADD CONSTRAINT acc_race_sessions_track_key_fkey FOREIGN KEY (track_key) REFERENCES public.acc_tracks(track_key);


--
-- Name: acevo_hotlap_cache_v2 acevo_hotlap_cache_v2_layout_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_hotlap_cache_v2
    ADD CONSTRAINT acevo_hotlap_cache_v2_layout_key_fkey FOREIGN KEY (layout_key) REFERENCES public.track_layouts(layout_key);


--
-- Name: acevo_round_points_cache_v2 acevo_round_points_cache_v2_layout_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acevo_round_points_cache_v2
    ADD CONSTRAINT acevo_round_points_cache_v2_layout_key_fkey FOREIGN KEY (layout_key) REFERENCES public.track_layouts(layout_key);


--
-- Name: championship_rounds championship_rounds_championship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.championship_rounds
    ADD CONSTRAINT championship_rounds_championship_id_fkey FOREIGN KEY (championship_id) REFERENCES public.championships(id) ON DELETE CASCADE;


--
-- Name: classification classification_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification
    ADD CONSTRAINT classification_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_ratings driver_ratings_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_ratings
    ADD CONSTRAINT driver_ratings_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: drivers drivers_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id);


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: registration_drivers registration_drivers_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_drivers
    ADD CONSTRAINT registration_drivers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: registration_drivers registration_drivers_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_drivers
    ADD CONSTRAINT registration_drivers_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE CASCADE;


--
-- Name: registrations registrations_car_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_car_model_id_fkey FOREIGN KEY (car_model_id) REFERENCES public.acc_cars(car_model_id);


--
-- Name: registrations registrations_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id);


--
-- Name: registrations registrations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: srating_history srating_history_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.srating_history
    ADD CONSTRAINT srating_history_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: team_members team_members_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_registrations team_reg_car_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_registrations
    ADD CONSTRAINT team_reg_car_fk FOREIGN KEY (car_model_id) REFERENCES public.acc_cars(car_model_id);


--
-- Name: team_registration_drivers team_registration_drivers_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_registration_drivers
    ADD CONSTRAINT team_registration_drivers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: team_registration_drivers team_registration_drivers_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_registration_drivers
    ADD CONSTRAINT team_registration_drivers_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.team_registrations(id) ON DELETE CASCADE;


--
-- Name: team_registrations team_registrations_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_registrations
    ADD CONSTRAINT team_registrations_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id);


--
-- Name: track_layouts track_layouts_base_track_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_layouts
    ADD CONSTRAINT track_layouts_base_track_key_fkey FOREIGN KEY (base_track_key) REFERENCES public.tracks(base_track_key);


--
-- Name: acc_cars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_cars ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_hotlap_leaderboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_hotlap_leaderboard ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_hotlap_leaderboard acc_hotlap_leaderboard_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acc_hotlap_leaderboard_select_all ON public.acc_hotlap_leaderboard FOR SELECT USING (true);


--
-- Name: acc_hotlap_refresh_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_hotlap_refresh_state ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_hotstint_leaderboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_hotstint_leaderboard ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_processed_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_processed_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_race_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_race_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_race_sessions acc_race_sessions_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acc_race_sessions_select_all ON public.acc_race_sessions FOR SELECT USING (true);


--
-- Name: acc_tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_tracks ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_tracks acc_tracks_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acc_tracks_select_all ON public.acc_tracks FOR SELECT USING (true);


--
-- Name: acevo_hotlap_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_hotlap_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_hotlap_cache_v2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_hotlap_cache_v2 ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_hotlap_cache_v2 acevo_hotlap_cache_v2_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acevo_hotlap_cache_v2_select_all ON public.acevo_hotlap_cache_v2 FOR SELECT USING (true);


--
-- Name: acevo_hotlap_refresh_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_hotlap_refresh_state ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_processed_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_processed_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_race_results_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_race_results_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_round_points_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_round_points_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_round_points_cache_v2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acevo_round_points_cache_v2 ENABLE ROW LEVEL SECURITY;

--
-- Name: acevo_round_points_cache_v2 acevo_round_points_cache_v2_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acevo_round_points_cache_v2_select_all ON public.acevo_round_points_cache_v2 FOR SELECT USING (true);


--
-- Name: bop_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bop_config ENABLE ROW LEVEL SECURITY;

--
-- Name: bop_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bop_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: bot_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bot_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: championship_rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.championship_rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: championship_rounds championship_rounds_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY championship_rounds_select_all ON public.championship_rounds FOR SELECT USING (true);


--
-- Name: championships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;

--
-- Name: championships championships_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY championships_select_all ON public.championships FOR SELECT USING (true);


--
-- Name: classification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classification ENABLE ROW LEVEL SECURITY;

--
-- Name: divisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

--
-- Name: divisions divisions_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY divisions_select_all ON public.divisions FOR SELECT USING (true);


--
-- Name: driver_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: drivers drivers_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY drivers_insert_own ON public.drivers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: drivers drivers_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY drivers_select_own ON public.drivers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: drivers drivers_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY drivers_update_own ON public.drivers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ref_times; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ref_times ENABLE ROW LEVEL SECURITY;

--
-- Name: registration_drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registration_drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: settings settings_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_select_all ON public.settings FOR SELECT USING (true);


--
-- Name: srating_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.srating_history ENABLE ROW LEVEL SECURITY;

--
-- Name: standings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_registration_drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_registration_drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: team_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: track_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.track_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: track_layouts track_layouts_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_layouts_select_all ON public.track_layouts FOR SELECT USING (true);


--
-- Name: tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

--
-- Name: tracks tracks_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracks_select_all ON public.tracks FOR SELECT USING (true);


--
-- PostgreSQL database dump complete
--

\unrestrict NGcTjxW3e6Ft3QW9CWnHiq5ZeyjDD3Lj6eTHyHWGEtKsPhJtYbYrf8HqpJkufVc

