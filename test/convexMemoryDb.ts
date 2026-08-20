/**
 * Una base Convex mínima, en memoria, para poder probar las mutaciones REALES.
 *
 * Existe por un motivo concreto: la persistencia natal decide dentro de la
 * transacción, comparando contra el estado vigente. Una prueba que llame a la
 * mutación de a una, con un `runMutation` falso que siempre escribe lo que le
 * dan, no prueba nada de eso: la carrera que hay que reproducir es dos corridas
 * que arrancan del mismo estado y terminan en orden invertido.
 *
 * Implementa exactamente lo que usan los módulos bajo prueba: `insert`, `get`,
 * `patch`, y `query(tabla).withIndex(nombre, q => q.eq(...)).first()` con su
 * `order("desc")`. Los documentos se clonan al entrar y al salir, así que una
 * prueba no puede mutar la base por accidente y creer que pasó.
 */

export type MemoryDoc = Record<string, any> & { _id: string; _creationTime: number };

const clonar = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

export type MemoryDb = {
  db: any;
  /** Inserta sin pasar por una mutación: la base de partida de cada escenario. */
  seed: (table: string, fields: Record<string, any>) => string;
  /** Todas las filas de una tabla, en orden de inserción. */
  rows: (table: string) => MemoryDoc[];
  /** Una fila por id, ya clonada. */
  row: (id: string) => MemoryDoc | null;
};

export function createMemoryDb(): MemoryDb {
  const tables = new Map<string, MemoryDoc[]>();
  const porId = new Map<string, { table: string; doc: MemoryDoc }>();
  let secuencia = 0;

  const tabla = (name: string) => {
    const actual = tables.get(name);
    if (actual) return actual;
    const nueva: MemoryDoc[] = [];
    tables.set(name, nueva);
    return nueva;
  };

  const insertar = (table: string, fields: Record<string, any>) => {
    secuencia += 1;
    const doc = {
      ...clonar(fields),
      // La secuencia va con padding para que el id se parezca a uno real en lo
      // único que el código de producción mira: el largo. `recordBackendProductEvent`
      // pasa `String(userId)` por `assertOpaqueAnalyticsId`, que exige ≥ 8
      // caracteres — con `users:1` la mutación real tiraba "Invalid dedupeKey"
      // y la prueba medía el fake, no el sistema.
      _id: `${table}:${String(secuencia).padStart(8, "0")}`,
      _creationTime: secuencia
    } as MemoryDoc;
    tabla(table).push(doc);
    porId.set(doc._id, { table, doc });
    return doc._id;
  };

  /** El `q` que reciben los callbacks de `withIndex`: sólo acumula igualdades. */
  const constructorDeIndice = (constraints: Array<[string, unknown]>) => {
    const q: any = {
      eq(field: string, value: unknown) {
        constraints.push([field, value]);
        return q;
      }
    };
    return q;
  };

  const db = {
    async get(id: string) {
      const entry = porId.get(id);
      return entry ? clonar(entry.doc) : null;
    },
    async insert(table: string, fields: Record<string, any>) {
      return insertar(table, fields);
    },
    async patch(id: string, fields: Record<string, any>) {
      const entry = porId.get(id);
      if (!entry) throw new Error(`patch sobre un documento inexistente: ${id}`);
      Object.assign(entry.doc, clonar(fields));
      return null;
    },
    async delete(id: string) {
      const entry = porId.get(id);
      if (!entry) return null;
      const filas = tabla(entry.table);
      filas.splice(filas.indexOf(entry.doc), 1);
      porId.delete(id);
      return null;
    },
    query(table: string) {
      let constraints: Array<[string, unknown]> = [];
      let descendente = false;
      const cursor: any = {
        withIndex(_name: string, build?: (q: any) => unknown) {
          constraints = [];
          if (build) build(constructorDeIndice(constraints));
          return cursor;
        },
        order(direction: "asc" | "desc") {
          descendente = direction === "desc";
          return cursor;
        },
        async collect() {
          const filas = tabla(table).filter((doc) =>
            constraints.every(([field, value]) => doc[field] === value)
          );
          return (descendente ? [...filas].reverse() : filas).map(clonar);
        },
        async first() {
          const filas = await cursor.collect();
          return filas[0] ?? null;
        }
      };
      return cursor;
    }
  };

  return {
    db,
    seed: insertar,
    rows: (table: string) => tabla(table).map(clonar),
    row: (id: string) => {
      const entry = porId.get(id);
      return entry ? clonar(entry.doc) : null;
    }
  };
}
