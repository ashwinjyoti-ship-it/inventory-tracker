import { json } from "../_shared.js";

export const onRequestGet = async ({ env }) => {
  const [venues, crew] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, code, is_outdoor, active FROM venues WHERE active = 1 ORDER BY is_outdoor, name",
    ).all(),
    env.DB.prepare(
      "SELECT id, name, role, active FROM crew WHERE active = 1 ORDER BY role DESC, name",
    ).all(),
  ]);
  return json({
    venues: venues.results || [],
    crew: crew.results || [],
  });
};
