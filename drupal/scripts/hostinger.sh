#!/usr/bin/env bash
# Deploy the Drupal backend on Hostinger web hosting (run over SSH on the server).
#
#   bash hostinger.sh install <site-folder>   first deployment on an empty site
#   bash hostinger.sh update  <site-folder>   every later deployment (pull, composer, drush deploy, import)
#   bash hostinger.sh status  <site-folder>
#
# <site-folder> is the folder under ~/domains/ (the site's domain). Layout:
#   ~/domains/<site>/app/            this repository (branch $BRANCH, default main)
#   ~/domains/<site>/public_html  →  app/drupal/web   (a link: Drupal is served from web/)
# Secrets live only in app/drupal/web/sites/default/settings.local.php (git-ignored), which
# `install` creates: it asks for the database credentials and generates the hash salt and
# the feedback secret on the server.

set -euo pipefail

CMD="${1:-}"
SITE="${2:-}"
[ -n "$CMD" ] && [ -n "$SITE" ] || { echo "Usage: bash $0 install|update|status <site-folder>"; exit 1; }
REPO="${REPO:-https://github.com/i2amparis/achieve-stakeholder-platform.git}"
BRANCH="${BRANCH:-main}"
BASE="$HOME/domains/$SITE"
APP="$BASE/app"
DRUPAL="$APP/drupal"
WEBROOT="$BASE/public_html"
LOCAL="$DRUPAL/web/sites/default/settings.local.php"
DRUSH="$DRUPAL/vendor/bin/drush"   # a shell launcher: run it directly, not with php
STAMP=$(date +%Y%m%d%H%M%S)
DB_HOST="${DB_HOST:-localhost}"   # Hostinger: localhost

step() { echo; echo "== $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
[ -d "$BASE" ] || die "No such site folder: $BASE"
php -r 'exit(version_compare(PHP_VERSION, "8.3.0", ">=") ? 0 : 1);' || die "PHP 8.3 or later is needed on the command line"

composer_install() {
	chmod u+w "$DRUPAL/web/sites/default" 2>/dev/null || true
	(cd "$DRUPAL" && COMPOSER_MEMORY_LIMIT=-1 composer install --no-dev --no-interaction --optimize-autoloader --quiet)
	chmod 555 "$DRUPAL/web/sites/default"
}

write_local_settings() {
	echo "Database (hPanel → Databases; names include the account prefix)."
	read -r -p "  database name: " DB_NAME
	read -r -p "  database user: " DB_USER
	read -r -s -p "  database password (not shown): " DB_PASS; echo
	local tables
	tables=$(MYSQL_PWD="$DB_PASS" mysql -h"$DB_HOST" -u"$DB_USER" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null || echo "ERR")
	[ "$tables" = "0" ] || die "Database not reachable or not empty ($tables tables). Use an empty database."
	FEEDBACK_SECRET=$(php -r 'echo bin2hex(random_bytes(32));')
	chmod u+w "$DRUPAL/web/sites/default"
	DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASS="$DB_PASS" DB_HOST="$DB_HOST" SITE="$SITE" FEEDBACK_SECRET="$FEEDBACK_SECRET" php -r '
		$db = ["database" => getenv("DB_NAME"), "username" => getenv("DB_USER"), "password" => getenv("DB_PASS"),
		       "host" => getenv("DB_HOST"), "port" => "3306", "driver" => "mysql", "prefix" => "", "collation" => "utf8mb4_general_ci"];
		echo "<?php\n\n// Server settings: secrets, never in git. Created by scripts/hostinger.sh.\n\n";
		echo "\$databases[\"default\"][\"default\"] = ", var_export($db, true), ";\n";
		echo "\$settings[\"hash_salt\"] = ", var_export(bin2hex(random_bytes(32)), true), ";\n";
		echo "\$settings[\"trusted_host_patterns\"] = [", var_export("^" . preg_quote(getenv("SITE")) . "\$", true), "];\n";
		echo "\$settings[\"achieve_feedback_secret\"] = ", var_export(getenv("FEEDBACK_SECRET"), true), ";\n";' > "$LOCAL"
	chmod 400 "$LOCAL"
}

case "$CMD" in
install)
	step "Preconditions"
	[ ! -e "$APP" ] || die "$APP already exists: use 'update'."
	[ ! -L "$WEBROOT" ] || die "$WEBROOT is already a link (a previous install or test?). Undo it first."
	extra=$(find "$WEBROOT" -mindepth 1 -maxdepth 1 ! -name 'default.php' ! -name 'index.html' ! -name '.htaccess' ! -name '.well-known' ! -name 'favicon.ico' 2>/dev/null || true)
	[ -z "$extra" ] || die "public_html is not empty: $extra"
	if [ -f "$WEBROOT/default.php" ] && ! grep -qi hostinger "$WEBROOT/default.php"; then die "public_html/default.php is not Hostinger's placeholder."; fi
	command -v composer >/dev/null || die "composer not found"

	step "Code: clone $BRANCH, composer install (a few minutes)"
	git clone --quiet --branch "$BRANCH" "$REPO" "$APP"
	# settings.php is locked read-only on the server; that must not count as a local change.
	git -C "$APP" config core.fileMode false
	composer_install

	step "Settings (secrets stay on this server)"
	write_local_settings

	step "Serve Drupal from drupal/web"
	mv "$WEBROOT" "$BASE/public_html.before-app-$STAMP"
	ln -s "$DRUPAL/web" "$WEBROOT"

	step "Site from config, then content"
	(cd "$DRUPAL" && "$DRUSH" site:install --existing-config --account-name=admin --account-pass="$(php -r 'echo bin2hex(random_bytes(16));')" --yes --quiet)
	chmod 444 "$DRUPAL/web/sites/default/settings.php"
	chmod 555 "$DRUPAL/web/sites/default"
	(cd "$DRUPAL" && "$DRUSH" achieve:import && "$DRUSH" achieve:seed && "$DRUSH" cron --quiet)

	step "Done"
	echo "Drupal: https://$SITE (admin login: cd $DRUPAL && vendor/bin/drush user:login --uri=https://$SITE)"
	echo
	echo "For the SvelteKit app's environment variables in hPanel (copy now; it is not shown again):"
	echo "  DRUPAL_URL=https://$SITE"
	echo "  DRUPAL_FEEDBACK_SECRET=$FEEDBACK_SECRET"
	echo
	echo "Cron (hPanel → Advanced → Cron Jobs), hourly:"
	echo "  cd $DRUPAL && vendor/bin/drush cron --quiet"
	;;
update)
	[ -d "$APP/.git" ] || die "$APP is not a checkout: use 'install'."
	step "Code: pull $BRANCH"
	git -C "$APP" config core.fileMode false
	git -C "$APP" fetch --quiet origin "$BRANCH"
	git -C "$APP" checkout --quiet "$BRANCH"
	git -C "$APP" pull --quiet --ff-only origin "$BRANCH"
	git -C "$APP" log --oneline -1
	composer_install
	step "drush deploy (database updates, config import, caches)"
	(cd "$DRUPAL" && "$DRUSH" deploy --yes)
	step "Content from the sheet (idempotent) and project copy (fills gaps)"
	(cd "$DRUPAL" && "$DRUSH" achieve:import && "$DRUSH" achieve:seed)
	;;
status)
	git -C "$APP" log --oneline -1
	(cd "$DRUPAL" && "$DRUSH" status --fields=drupal-version,php-version,db-status,bootstrap && "$DRUSH" config:status)
	;;
*)
	die "Unknown command: $CMD"
	;;
esac
