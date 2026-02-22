--
-- PostgreSQL database dump
--

\restrict 8DUnD2kErcrWmg458C5JwwsgqzOeint6M9OboDk4pL706Mn0qEi5oV75TAelhKy

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg12+2)
-- Dumped by pg_dump version 18.2 (Debian 18.2-1.pgdg13+1)

-- Started on 2026-02-22 07:24:24 UTC

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
-- TOC entry 6 (class 2615 OID 16599)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 3494 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 2 (class 3079 OID 16600)
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- TOC entry 3495 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 222 (class 1259 OID 16644)
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id integer NOT NULL,
    local_id integer NOT NULL,
    snapshot_id integer,
    title character varying NOT NULL,
    description character varying,
    parent_id integer,
    collapsed boolean
);


--
-- TOC entry 223 (class 1259 OID 16652)
-- Name: domains_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.domains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3496 (class 0 OID 0)
-- Dependencies: 223
-- Name: domains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.domains_id_seq OWNED BY public.domains.id;


--
-- TOC entry 224 (class 1259 OID 16653)
-- Name: draft_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_domains (
    id integer NOT NULL,
    local_id integer NOT NULL,
    title character varying NOT NULL,
    description character varying,
    parent_id integer,
    collapsed boolean
);


--
-- TOC entry 225 (class 1259 OID 16661)
-- Name: draft_domains_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.draft_domains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3497 (class 0 OID 0)
-- Dependencies: 225
-- Name: draft_domains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.draft_domains_id_seq OWNED BY public.draft_domains.id;


--
-- TOC entry 226 (class 1259 OID 16662)
-- Name: draft_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_nodes (
    id integer NOT NULL,
    local_id integer NOT NULL,
    domain_id integer,
    title character varying NOT NULL,
    description character varying,
    prerequisite character varying,
    mentions character varying,
    sources character varying
);


--
-- TOC entry 227 (class 1259 OID 16670)
-- Name: draft_nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.draft_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3498 (class 0 OID 0)
-- Dependencies: 227
-- Name: draft_nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.draft_nodes_id_seq OWNED BY public.draft_nodes.id;


--
-- TOC entry 228 (class 1259 OID 16671)
-- Name: graph_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.graph_snapshots (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    version_label character varying,
    last_updated timestamp with time zone,
    created_by_id integer,
    base_graph_id integer,
    is_public boolean DEFAULT false NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 16678)
-- Name: graph_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.graph_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3499 (class 0 OID 0)
-- Dependencies: 229
-- Name: graph_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.graph_snapshots_id_seq OWNED BY public.graph_snapshots.id;


--
-- TOC entry 230 (class 1259 OID 16679)
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id integer NOT NULL,
    code character varying NOT NULL,
    is_used boolean,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 231 (class 1259 OID 16687)
-- Name: invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3500 (class 0 OID 0)
-- Dependencies: 231
-- Name: invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invitations_id_seq OWNED BY public.invitations.id;


--
-- TOC entry 232 (class 1259 OID 16688)
-- Name: nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nodes (
    id integer NOT NULL,
    snapshot_id integer,
    domain_id integer,
    local_id integer NOT NULL,
    title character varying NOT NULL,
    description character varying,
    prerequisite character varying,
    mentions character varying,
    x integer,
    y integer
);


--
-- TOC entry 233 (class 1259 OID 16696)
-- Name: nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3501 (class 0 OID 0)
-- Dependencies: 233
-- Name: nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nodes_id_seq OWNED BY public.nodes.id;


--
-- TOC entry 234 (class 1259 OID 16697)
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id integer NOT NULL,
    node_id integer NOT NULL,
    title character varying NOT NULL,
    author character varying,
    year integer,
    source_type character varying NOT NULL,
    url character varying,
    fragment_start character varying,
    fragment_end character varying
);


--
-- TOC entry 235 (class 1259 OID 16706)
-- Name: sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3502 (class 0 OID 0)
-- Dependencies: 235
-- Name: sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sources_id_seq OWNED BY public.sources.id;


--
-- TOC entry 236 (class 1259 OID 16707)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying NOT NULL,
    hashed_password character varying NOT NULL,
    is_active boolean
);


--
-- TOC entry 237 (class 1259 OID 16715)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3503 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3274 (class 2604 OID 16716)
-- Name: domains id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains ALTER COLUMN id SET DEFAULT nextval('public.domains_id_seq'::regclass);


--
-- TOC entry 3275 (class 2604 OID 16717)
-- Name: draft_domains id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_domains ALTER COLUMN id SET DEFAULT nextval('public.draft_domains_id_seq'::regclass);


--
-- TOC entry 3276 (class 2604 OID 16718)
-- Name: draft_nodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_nodes ALTER COLUMN id SET DEFAULT nextval('public.draft_nodes_id_seq'::regclass);


--
-- TOC entry 3277 (class 2604 OID 16719)
-- Name: graph_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.graph_snapshots ALTER COLUMN id SET DEFAULT nextval('public.graph_snapshots_id_seq'::regclass);


--
-- TOC entry 3280 (class 2604 OID 16720)
-- Name: invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations ALTER COLUMN id SET DEFAULT nextval('public.invitations_id_seq'::regclass);


--
-- TOC entry 3282 (class 2604 OID 16721)
-- Name: nodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes ALTER COLUMN id SET DEFAULT nextval('public.nodes_id_seq'::regclass);


--
-- TOC entry 3283 (class 2604 OID 16722)
-- Name: sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources ALTER COLUMN id SET DEFAULT nextval('public.sources_id_seq'::regclass);


--
-- TOC entry 3284 (class 2604 OID 16723)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3473 (class 0 OID 16644)
-- Dependencies: 222
-- Data for Name: domains; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.domains (id, local_id, snapshot_id, title, description, parent_id, collapsed) FROM stdin;
1	1	1	Domain 1	\N	\N	t
13	8000	4	Vanilla Frontend Development		\N	f
14	8001	4	HTML		13	t
16	67	2	Basic Mechanics		\N	f
18	67	6	Basic Mechanics		\N	f
42	69	10	Mechanics		\N	f
43	68	10	Motion of system of particles		42	f
44	67	10	Basic Mechanics		42	f
45	69	11	Mechanics		\N	f
46	68	11	Motion of system of particles		45	t
47	67	11	Basic Mechanics		45	t
48	70	11	Rotational Mechanics		45	t
49	42	12	Set Theory		\N	t
50	69	12	Group Theory		\N	t
\.


--
-- TOC entry 3475 (class 0 OID 16653)
-- Dependencies: 224
-- Data for Name: draft_domains; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.draft_domains (id, local_id, title, description, parent_id, collapsed) FROM stdin;
\.


--
-- TOC entry 3477 (class 0 OID 16662)
-- Dependencies: 226
-- Data for Name: draft_nodes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.draft_nodes (id, local_id, domain_id, title, description, prerequisite, mentions, sources) FROM stdin;
\.


--
-- TOC entry 3479 (class 0 OID 16671)
-- Dependencies: 228
-- Data for Name: graph_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.graph_snapshots (id, created_at, version_label, last_updated, created_by_id, base_graph_id, is_public) FROM stdin;
1	2026-01-31 08:56:52.72366+00	Base v1.0	2026-01-31 08:56:52.72366+00	\N	\N	f
4	2026-02-08 11:57:30.939068+00	Front End Web Development	2026-02-09 13:12:38.405892+00	4	\N	f
2	2026-01-31 09:00:38.073057+00	Base v2.0	2026-02-13 07:26:18.531644+00	\N	\N	f
6	2026-02-13 07:21:29.268116+00	Mechanics	2026-02-13 12:39:52.775623+00	5	\N	f
10	2026-02-20 07:49:52.159662+00	Modified Mechanics	2026-02-21 06:20:21.939522+00	4	6	f
11	2026-02-20 08:48:05.471986+00	Added COM	2026-02-21 08:17:42.033618+00	5	10	f
12	2026-02-21 10:28:56.072324+00	Abstract Algebra	2026-02-21 12:26:49.902823+00	4	\N	t
\.


--
-- TOC entry 3481 (class 0 OID 16679)
-- Dependencies: 230
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invitations (id, code, is_used, created_at) FROM stdin;
3	RAJIRTA_BROTHER	t	2026-02-06 06:25:53.768263+00
1	ARITRA_BROTHER	t	2026-02-06 06:24:01.224954+00
2	SOUVIK_BROTHER	t	2026-02-06 06:24:29.830353+00
\.


--
-- TOC entry 3483 (class 0 OID 16688)
-- Dependencies: 232
-- Data for Name: nodes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nodes (id, snapshot_id, domain_id, local_id, title, description, prerequisite, mentions, x, y) FROM stdin;
62	2	16	6701	Motion	Discusses what is motion and some numericals	6703	\N	\N	\N
63	2	16	6702	Newton's Laws of Motion	Discusses Newton's 3 laws of motion	6701	\N	\N	\N
64	2	16	6703	Force	What is force?		\N	\N	\N
65	2	16	6704	Gravity	Discusses Gravity	6703	\N	\N	\N
66	2	16	6705	Law of Gravitation	Discusses Law of Gravitation	6704	\N	\N	\N
69	2	16	6708	Energy	Discusses Energy	6701 AND 6703	\N	\N	\N
70	2	16	6709	Conservation of Energy	Discusses law of conservation of energy	6708	\N	\N	\N
71	2	16	6710	Free Body	Discusses all the forces acting on free body	6706 AND 6707 AND 6709 AND 6705	\N	\N	\N
72	2	16	6711	Inclined Planes	Discusses forces acting on an object on an incline plane	6710	\N	\N	\N
1	1	\N	1	Node 1			2,3	\N	\N
2	1	\N	2	Node 2		1	\N	\N	\N
3	1	1	3	Node 3		1	\N	\N	\N
40	4	\N	1000	Basic IDE workflow	Learn what an IDE is, commonly used IDEs and how to download and install them. The main focus is on VS Code. 		\N	\N	\N
41	4	\N	2000	File formats	Learn about file formats like .py, .js, .html etc.		\N	\N	\N
42	4	14	8001	Basic HTML syntax	Learn about basic html structure and syntaxes, important components and how to run a basic html file	2000 AND 8000	\N	\N	\N
43	4	14	8002	Structuring contents	This node goes deeper into how to structure HTML documents properly. Learners will learn about different kinds of sections and elements and proper nesting. 	8001	\N	\N	\N
44	4	14	8003	More HTML elements	This introduces more useful HTML elements like tables and lists. 	8001	\N	\N	\N
45	4	13	8000	Environment setup	This shows how to setup your IDE environment properly for a basic vanilla website	1000	\N	\N	\N
46	4	14	8004	Webpage metadata	Learn about webpage metadata and "head"	8002	\N	\N	\N
47	4	14	8005	Advanced structuring	Learn about advanced structuring in HTML with headers, navigation bars etc	8002	\N	\N	\N
48	4	14	8006	Embedding advanced media	Learn how to embed media formats like audio, video, images etc	8001	\N	\N	\N
49	4	14	8007	Debugging HTML	Learn how to debug HTML. Although you can learn this at any time, it is advised to learn it after you can make complex codes enough to make mistakes! 	8001	\N	\N	\N
50	4	14	8008	More advanced embeddings	Learn about advanced embeddings like svg with flexible elements like "iframe" and "embed"	8006	\N	\N	\N
67	2	16	6706	Friction	Discusses Friction and mathematics of friction	6701 AND 6702	\N	\N	\N
68	2	16	6707	Inertia	Discusses inertia	6702 AND 6701	\N	\N	\N
84	6	18	6701	Motion	Discusses what is motion and some associated terms		\N	\N	\N
85	6	18	6702	Newton's Laws of Motion	Discusses the 3 laws of motion	6701	\N	\N	\N
86	6	18	6703	Force	What is force?	6701	\N	\N	\N
87	6	18	6704	Gravity	How do you define Gravity?	6703	\N	\N	\N
88	6	18	6705	Law of Gravitation	Discusses the universal law of gravitation	6704	\N	\N	\N
91	6	18	6708	Energy	Defines Energy	6701	\N	\N	\N
92	6	18	6709	Conservation of Energy	Discusses law of conservation of energy	6708	\N	\N	\N
93	6	18	6710	Free Body	Discusses all forces acting on a free body	6706 AND 6707 AND 6709 AND 6705	\N	\N	\N
94	6	18	6711	Inclined Planes	Discusses all forces acting on a body on an incline plane/surface	6710	\N	\N	\N
89	6	18	6706	Friction	Discusses friction	6702	\N	\N	\N
90	6	18	6707	Inertia	Discusses inertia	6702	\N	\N	\N
276	10	44	6701	Motion	Discusses what is motion and some associated terms		\N	\N	\N
277	10	44	6702	Newton's Laws of Motion	Discusses the 3 laws of motion	6701	\N	\N	\N
278	10	44	6703	Force	What is force?	6701 AND 6702	\N	\N	\N
279	10	44	6704	Gravity	How do you define Gravity?	6703	\N	\N	\N
280	10	44	6705	Law of Gravitation	Discusses the universal law of gravitation	6704	\N	\N	\N
281	10	44	6708	Energy	Defines Energy	6701	\N	\N	\N
282	10	44	6709	Conservation of Energy	Discusses law of conservation of energy	6708	\N	\N	\N
283	10	44	6710	Free Body	Discusses all forces acting on a free body	6702 	\N	\N	\N
284	10	44	6711	Inclined Planes	Discusses all forces acting on a body on an incline plane/surface	6710 AND 6707 AND 6704	\N	\N	\N
285	10	44	6707	Friction	Discusses friction	6703	\N	\N	\N
286	10	44	6706	Inertia	Discusses inertia	6702	\N	\N	\N
287	10	44	6712	Free Fall	Discusses free fall	6705	\N	\N	\N
288	10	44	6713	Projectile Motion	Discusses the mechanics of projectiles	6712	\N	\N	\N
289	10	44	6714	Uniform Circular motion	describes motion in a circular path	6710	\N	\N	\N
290	10	44	6715	Motion in 3D space	Discusses the expressions to calculate motion in 3D space using vectors	6701	\N	\N	\N
291	10	43	6801	Centre of Mass of System particles	Discusses the centre of mass of system and n particles and its expression		\N	\N	\N
292	10	43	6802	Centre of mass of uniform rod			\N	\N	\N
293	10	43	6803	Motion of COM 		6801 AND 6802 AND 6703	\N	\N	\N
294	10	43	6804	Linear Momentum of system of particles		6803	\N	\N	\N
295	10	43	6805	COM of rigid body		6802	\N	\N	\N
296	10	43	6806	Conservation of momentum		6804	\N	\N	\N
297	11	47	6701	Motion	Discusses what is motion and some associated terms		\N	\N	\N
298	11	47	6702	Newton's Laws of Motion	Discusses the 3 laws of motion	6701	\N	\N	\N
299	11	47	6703	Force	What is force?	6701 AND 6702	\N	\N	\N
300	11	47	6704	Gravity	How do you define Gravity?	6703	\N	\N	\N
301	11	47	6705	Law of Gravitation	Discusses the universal law of gravitation	6704	\N	\N	\N
302	11	47	6708	Energy	Defines Energy	6701	\N	\N	\N
303	11	47	6709	Conservation of Energy	Discusses law of conservation of energy	6708	\N	\N	\N
304	11	47	6710	Free Body	Discusses all forces acting on a free body	6702 	\N	\N	\N
305	11	47	6711	Inclined Planes	Discusses all forces acting on a body on an incline plane/surface	6710 AND 6707	\N	\N	\N
306	11	47	6707	Friction	Discusses friction	6703	\N	\N	\N
307	11	47	6706	Inertia	Discusses inertia	6702	\N	\N	\N
308	11	47	6712	Free Fall	Discusses free fall	6705	\N	\N	\N
309	11	47	6713	Projectile Motion	Discusses the mechanics of projectiles	6712	\N	\N	\N
310	11	47	6714	Uniform Circular motion	describes motion in a circular path	6702 AND 6710	\N	\N	\N
311	11	47	6715	Motion in 3D space (using vectors)	Discusses the expressions to calculate motion in 3D space using vectors	6701	\N	\N	\N
312	11	46	6801	COM of n particles	Discusses the centre of mass of system and n particles and its expression		\N	\N	\N
313	11	46	6802	COM of uniform rod			\N	\N	\N
314	11	46	6803	Motion of COM 		6801 AND 6802 AND 6702 AND 6703	\N	\N	\N
315	11	46	6804	Linear Momentum 		6803	\N	\N	\N
316	11	46	6805	COM of rigid body		6802	\N	\N	\N
317	11	46	6806	Conservation of momentum		6804	\N	\N	\N
318	11	48	7001	Angular Velocity & Acceleration	Discusses Angular Velocity and acceleration and their relation to linear velocity and acceleration respectively.		\N	\N	\N
319	11	48	7002	Torque			\N	\N	\N
320	11	48	7003	Couple		7002	\N	\N	\N
321	11	48	7004	Work in rotation		7001 AND 7002	\N	\N	\N
322	11	48	7005	Angular Momentum		7001	\N	\N	\N
323	11	48	7006	τ and P for n particles		7002 AND 7005	\N	\N	\N
324	11	48	7007	Equilibrium of rigid bodies		7005	\N	\N	\N
325	11	48	7008	Principle of moments			\N	\N	\N
326	11	48	7009	Centre of gravity		7008	\N	\N	\N
327	11	48	7010	Types of equilibrium		7007	\N	\N	\N
328	11	48	7011	Pendulum in a vertical plane		7005	\N	\N	\N
329	11	48	7012	Derivation of kinetic equations		7005	\N	\N	\N
354	12	49	1	Basic Set Operations	Introduces basic set operations like union, intersect and complements		\N	\N	\N
355	12	49	2	Set Operation Algebras	Discusses how to manipulate expressions of sets and set operations. Introduces key identities and theorems	1	\N	\N	\N
356	12	\N	3	Relations	Introduces Relations in an intuitive and formal way with set theory	24	\N	\N	\N
357	12	\N	4	Functions	Discusses a special class of Relations called functions with their basic properties and uses	3	\N	\N	\N
358	12	\N	5	Function Properties	Introduces the different types of function properties like injectivity and surjectivity and why they are important	4	\N	\N	\N
359	12	\N	6	Inverse Functions	Introduces some inverse functions and their relations with properties like bijectivity	5	\N	\N	\N
360	12	\N	7	Permutation Functions	Discusses how permutations of of elements of a set can be represented as bijective functions	5	\N	\N	\N
361	12	\N	8	Permutation Set	Defines and discusses the relevance of the permutation set of a set	7	\N	\N	\N
362	12	\N	9	Permutation Operations	Introduces the concept of permutation combining as a binary operation inside the permutation set	8 AND 10	\N	\N	\N
363	12	\N	10	Binary Operations	Introduces binary operations as special relations satisfying key constraints (with examples)	4	\N	\N	\N
364	12	\N	11	Algebraic Structures	Provides an overview of algebraic structures as sets equipped with one or more binary operations satisfying certain axioms.	10	\N	\N	\N
365	12	\N	12	Semigroups	Introduces algebraic structures consisting of a set and an associative binary operation.	11 AND 25	\N	\N	\N
366	12	\N	13	Monoids	Defines semigroups that also contain an identity element for their binary operation.	11 AND 25	\N	\N	\N
367	12	50	15	Groups	Formal definition of a group as an algebraic structure satisfying the group axioms, a cornerstone of abstract algebra.	11 AND 25	\N	\N	\N
368	12	50	16	Abelian Groups	Explains groups where the binary operation is commutative, also known as commutative groups.	15	\N	\N	\N
369	12	50	17	Examples of Groups	Provides concrete illustrations of various sets and operations that form groups, such as integers under addition or permutation groups.	15	\N	\N	\N
370	12	50	18	Order of a Group	Defines the cardinality of a group (number of elements), distinguishing between finite and infinite groups.	15	\N	\N	\N
371	12	50	19	Order of an Element	Explains the smallest positive integer exponent for an element to yield the identity element within a group.	15	\N	\N	\N
372	12	50	20	Subgroups	Introduces subsets of a group that are themselves groups under the same binary operation, preserving the group structure.	15	\N	\N	\N
373	12	50	21	Cyclic Groups	Discusses groups that can be generated by a single element, and their fundamental properties.	16	\N	\N	\N
374	12	50	22	Group Homomorphisms	Defines structure-preserving maps between two groups, maintaining the group operation properties.	20	\N	\N	\N
375	12	50	23	Group Isomorphisms	Introduces bijective homomorphisms, signifying that two groups have identical algebraic structure and are indistinguishable from an algebraic perspective.	22	\N	\N	\N
376	12	49	24	Set Products	Introduces the concept of products of sets with examples	1	\N	\N	\N
377	12	\N	25	Binary Operation Properties	Discusses properties of certain of binary operations like commutativity, associativity etc	10	\N	\N	\N
\.


--
-- TOC entry 3485 (class 0 OID 16697)
-- Dependencies: 234
-- Data for Name: sources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sources (id, node_id, title, author, year, source_type, url, fragment_start, fragment_end) FROM stdin;
1	62	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N	Other	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N
2	62	https://cbse.io/class-9/science-motion/	\N	\N	Other	https://cbse.io/class-9/science-motion/	\N	\N
3	62	https://www.misostudy.com/watch/1537442692	\N	\N	Other	https://www.misostudy.com/watch/1537442692	\N	\N
4	62	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N	Other	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N
5	62	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N	Other	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N
6	62	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N	Other	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N
7	63	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N	Other	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N
8	63	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N
9	63	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N	Other	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N
10	64	https://www.geeksforgeeks.org/physics/force/	\N	\N	Other	https://www.geeksforgeeks.org/physics/force/	\N	\N
11	64	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N
12	65	https://www.geeksforgeeks.org/physics/gravity/	\N	\N	Other	https://www.geeksforgeeks.org/physics/gravity/	\N	\N
13	66	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N	Other	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N
14	69	https://byjus.com/physics/energy/	\N	\N	Other	https://byjus.com/physics/energy/	\N	\N
15	70	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N	Other	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N
16	71	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N	Other	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N
17	72	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N	Other	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N
18	84	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N	Other	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N
19	84	https://cbse.io/class-9/science-motion/	\N	\N	Other	https://cbse.io/class-9/science-motion/	\N	\N
20	84	https://www.misostudy.com/watch/1537442692	\N	\N	Other	https://www.misostudy.com/watch/1537442692	\N	\N
21	84	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N	Other	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N
22	84	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N	Other	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N
23	84	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N	Other	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N
24	85	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N	Other	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N
25	85	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N
26	85	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N	Other	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N
27	86	https://www.geeksforgeeks.org/physics/force/	\N	\N	Other	https://www.geeksforgeeks.org/physics/force/	\N	\N
28	86	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N
29	87	https://www.geeksforgeeks.org/physics/gravity/	\N	\N	Other	https://www.geeksforgeeks.org/physics/gravity/	\N	\N
30	88	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N	Other	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N
31	91	https://byjus.com/physics/energy/	\N	\N	Other	https://byjus.com/physics/energy/	\N	\N
32	92	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N	Other	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N
33	93	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N	Other	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N
34	94	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N	Other	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N
192	276	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N	Other	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N
193	276	https://cbse.io/class-9/science-motion/	\N	\N	Other	https://cbse.io/class-9/science-motion/	\N	\N
194	276	https://www.misostudy.com/watch/1537442692	\N	\N	Other	https://www.misostudy.com/watch/1537442692	\N	\N
195	276	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N	Other	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N
196	276	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N	Other	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N
197	276	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N	Other	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N
198	277	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N	Other	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N
199	277	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N
200	277	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N	Other	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N
201	278	https://www.geeksforgeeks.org/physics/force/	\N	\N	Other	https://www.geeksforgeeks.org/physics/force/	\N	\N
202	278	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N
203	279	https://www.geeksforgeeks.org/physics/gravity/	\N	\N	Other	https://www.geeksforgeeks.org/physics/gravity/	\N	\N
204	280	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N	Other	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N
205	281	https://byjus.com/physics/energy/	\N	\N	Other	https://byjus.com/physics/energy/	\N	\N
206	282	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N	Other	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N
207	283	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N	Other	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N
208	284	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N	Other	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N
209	297	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N	Other	https://cbsenow.com/physics-class-9-understanding-motion-laws-of-motion-graphs/	\N	\N
210	297	https://cbse.io/class-9/science-motion/	\N	\N	Other	https://cbse.io/class-9/science-motion/	\N	\N
211	297	https://www.misostudy.com/watch/1537442692	\N	\N	Other	https://www.misostudy.com/watch/1537442692	\N	\N
212	297	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N	Other	https://www.youtube.com/watch?v=i5ZTwV-r-8o&t=1s	\N	\N
213	297	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N	Other	https://www.youtube.com/watch?v=BSEcm9Ehmqo	\N	\N
214	297	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N	Other	https://byjus.com/ncert-solutions-class-9-science/chapter-8-motion/	\N	\N
215	298	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N	Other	https://www.youtube.com/watch?v=tjlKrVuFES8	\N	\N
216	298	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/keph104.pdf	\N	\N
217	298	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N	Other	https://www.geeksforgeeks.org/physics/laws-of-motion-questions/	\N	\N
218	299	https://www.geeksforgeeks.org/physics/force/	\N	\N	Other	https://www.geeksforgeeks.org/physics/force/	\N	\N
219	299	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N	PDF	https://ncert.nic.in/textbook/pdf/iesc108.pdf	\N	\N
220	300	https://www.geeksforgeeks.org/physics/gravity/	\N	\N	Other	https://www.geeksforgeeks.org/physics/gravity/	\N	\N
221	301	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N	Other	https://www.geeksforgeeks.org/physics/universal-law-of-gravitation/	\N	\N
222	302	https://byjus.com/physics/energy/	\N	\N	Other	https://byjus.com/physics/energy/	\N	\N
223	303	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N	Other	https://www.geeksforgeeks.org/physics/law-of-conservation-of-energy	\N	\N
224	304	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N	Other	https://www.geeksforgeeks.org/physics/free-body-diagram/	\N	\N
225	305	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N	Other	https://www.geeksforgeeks.org/physics/inclined-plane/	\N	\N
\.


--
-- TOC entry 3487 (class 0 OID 16707)
-- Dependencies: 236
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, hashed_password, is_active) FROM stdin;
4	DarkSecret	$2b$12$b5zAGMb1jjOYj8DwHfeTEuirB1ueg2glmDHlcunrHOVKGyXexG6ze	t
5	MR. A	$2b$12$wfxYYiTVGWN3RurL4qWOqOUOmxzKwrKCnrPk.qR.MRnXwFbFjvfk.	t
6	Teddy	$2b$12$oEgAjPSuKHGjxObsxQkHF.KdwjLHimS7rz77QtGS8hyiYs/3Jxn3a	t
\.


--
-- TOC entry 3504 (class 0 OID 0)
-- Dependencies: 223
-- Name: domains_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.domains_id_seq', 50, true);


--
-- TOC entry 3505 (class 0 OID 0)
-- Dependencies: 225
-- Name: draft_domains_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.draft_domains_id_seq', 12, true);


--
-- TOC entry 3506 (class 0 OID 0)
-- Dependencies: 227
-- Name: draft_nodes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.draft_nodes_id_seq', 36, true);


--
-- TOC entry 3507 (class 0 OID 0)
-- Dependencies: 229
-- Name: graph_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.graph_snapshots_id_seq', 12, true);


--
-- TOC entry 3508 (class 0 OID 0)
-- Dependencies: 231
-- Name: invitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.invitations_id_seq', 3, true);


--
-- TOC entry 3509 (class 0 OID 0)
-- Dependencies: 233
-- Name: nodes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nodes_id_seq', 377, true);


--
-- TOC entry 3510 (class 0 OID 0)
-- Dependencies: 235
-- Name: sources_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sources_id_seq', 225, true);


--
-- TOC entry 3511 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- TOC entry 3286 (class 2606 OID 16725)
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- TOC entry 3289 (class 2606 OID 16727)
-- Name: draft_domains draft_domains_local_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_domains
    ADD CONSTRAINT draft_domains_local_id_key UNIQUE (local_id);


--
-- TOC entry 3291 (class 2606 OID 16729)
-- Name: draft_domains draft_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_domains
    ADD CONSTRAINT draft_domains_pkey PRIMARY KEY (id);


--
-- TOC entry 3294 (class 2606 OID 16731)
-- Name: draft_nodes draft_nodes_local_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_nodes
    ADD CONSTRAINT draft_nodes_local_id_key UNIQUE (local_id);


--
-- TOC entry 3296 (class 2606 OID 16733)
-- Name: draft_nodes draft_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_nodes
    ADD CONSTRAINT draft_nodes_pkey PRIMARY KEY (id);


--
-- TOC entry 3299 (class 2606 OID 16735)
-- Name: graph_snapshots graph_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.graph_snapshots
    ADD CONSTRAINT graph_snapshots_pkey PRIMARY KEY (id);


--
-- TOC entry 3302 (class 2606 OID 16737)
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 3307 (class 2606 OID 16739)
-- Name: nodes nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_pkey PRIMARY KEY (id);


--
-- TOC entry 3310 (class 2606 OID 16741)
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- TOC entry 3314 (class 2606 OID 16743)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3287 (class 1259 OID 16744)
-- Name: ix_domains_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_domains_id ON public.domains USING btree (id);


--
-- TOC entry 3292 (class 1259 OID 16745)
-- Name: ix_draft_domains_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_draft_domains_id ON public.draft_domains USING btree (id);


--
-- TOC entry 3297 (class 1259 OID 16746)
-- Name: ix_draft_nodes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_draft_nodes_id ON public.draft_nodes USING btree (id);


--
-- TOC entry 3300 (class 1259 OID 16747)
-- Name: ix_graph_snapshots_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_graph_snapshots_id ON public.graph_snapshots USING btree (id);


--
-- TOC entry 3303 (class 1259 OID 16748)
-- Name: ix_invitations_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_invitations_code ON public.invitations USING btree (code);


--
-- TOC entry 3304 (class 1259 OID 16749)
-- Name: ix_invitations_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invitations_id ON public.invitations USING btree (id);


--
-- TOC entry 3305 (class 1259 OID 16750)
-- Name: ix_nodes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_nodes_id ON public.nodes USING btree (id);


--
-- TOC entry 3308 (class 1259 OID 16751)
-- Name: ix_sources_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sources_id ON public.sources USING btree (id);


--
-- TOC entry 3311 (class 1259 OID 16752)
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- TOC entry 3312 (class 1259 OID 16753)
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- TOC entry 3315 (class 2606 OID 16754)
-- Name: domains domains_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.domains(id);


--
-- TOC entry 3316 (class 2606 OID 16759)
-- Name: domains domains_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.graph_snapshots(id);


--
-- TOC entry 3317 (class 2606 OID 16764)
-- Name: draft_domains draft_domains_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_domains
    ADD CONSTRAINT draft_domains_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.draft_domains(id);


--
-- TOC entry 3318 (class 2606 OID 16769)
-- Name: draft_nodes draft_nodes_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_nodes
    ADD CONSTRAINT draft_nodes_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.draft_domains(id);


--
-- TOC entry 3319 (class 2606 OID 16795)
-- Name: graph_snapshots fk_graph_snapshots_base_graph_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.graph_snapshots
    ADD CONSTRAINT fk_graph_snapshots_base_graph_id FOREIGN KEY (base_graph_id) REFERENCES public.graph_snapshots(id) ON DELETE SET NULL;


--
-- TOC entry 3320 (class 2606 OID 16790)
-- Name: graph_snapshots fk_graph_snapshots_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.graph_snapshots
    ADD CONSTRAINT fk_graph_snapshots_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3321 (class 2606 OID 16774)
-- Name: nodes nodes_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id);


--
-- TOC entry 3322 (class 2606 OID 16779)
-- Name: nodes nodes_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.graph_snapshots(id);


--
-- TOC entry 3323 (class 2606 OID 16784)
-- Name: sources sources_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.nodes(id);


-- Completed on 2026-02-22 07:24:49 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict 8DUnD2kErcrWmg458C5JwwsgqzOeint6M9OboDk4pL706Mn0qEi5oV75TAelhKy

