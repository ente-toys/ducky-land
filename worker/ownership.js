// All operations run synchronously on the single durable world directory.
// A prepared transfer is immutable. The source is fenced before the destination
// can accept input. Losing a reply at either step is safe to retry by ID.
export class OwnershipDirectory {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS simulation_owners (
      account TEXT PRIMARY KEY, owner TEXT NOT NULL, generation INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS simulation_transfers (
      id TEXT PRIMARY KEY, account TEXT NOT NULL, source TEXT NOT NULL,
      destination TEXT NOT NULL, generation INTEGER NOT NULL, state TEXT NOT NULL, charge INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS pending_simulation_transfer
      ON simulation_transfers(account) WHERE state='prepared';
      CREATE INDEX IF NOT EXISTS committed_simulation_destination
      ON simulation_transfers(account,destination,generation) WHERE state='committed';`);
  }

  locate(account) {
    this.sql.exec("INSERT OR IGNORE INTO simulation_owners VALUES(?, 'home', ?)", account, Date.now());
    return this.sql.exec('SELECT owner,generation FROM simulation_owners WHERE account=?', account).one();
  }

  transfer(id) {
    return this.sql.exec('SELECT * FROM simulation_transfers WHERE id=?', id).toArray()[0];
  }

  prepare({id, account, source, destination, generation, chargeBog = false}) {
    const prior = this.transfer(id);
    if (prior)
      return prior.account === account &&
        prior.source === source &&
        prior.destination === destination &&
        prior.generation === generation &&
        prior.charge === Number(chargeBog)
        ? prior
        : null;
    const current = this.locate(account);
    if (current.owner !== source || current.generation !== generation || source === destination) return null;
    this.sql.exec(
      "INSERT OR IGNORE INTO simulation_transfers VALUES(?,?,?,?,?,'prepared',?)",
      id,
      account,
      source,
      destination,
      generation,
      Number(chargeBog)
    );
    return this.transfer(id);
  }

  commit(id) {
    return this.storage.transactionSync(() => {
      const transfer = this.transfer(id);
      if (!transfer || transfer.state === 'aborted') return null;
      if (transfer.state === 'committed') return transfer;
      const updated = this.sql
        .exec(
          'UPDATE simulation_owners SET owner=?,generation=generation+1 WHERE account=? AND owner=? AND generation=? RETURNING generation',
          transfer.destination,
          transfer.account,
          transfer.source,
          transfer.generation
        )
        .toArray();
      if (!updated.length) return null;
      this.sql.exec("UPDATE simulation_transfers SET state='committed' WHERE id=?", id);
      return this.transfer(id);
    });
  }

  abort(id) {
    this.sql.exec("UPDATE simulation_transfers SET state='aborted' WHERE id=? AND state='prepared'", id);
    return this.transfer(id);
  }
}
