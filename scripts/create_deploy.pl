#!/usr/bin/perl

use strict;
use Carp;
use Data::Dumper;
use File::Basename;

my $DIR = dirname(__FILE__);

my $xclude = $DIR . "/deploy-exclude.txt";
my $ts = `date '+%Y%m%d_%H%M%S'`;chop($ts);

my $deployedDir = $DIR . "/../deployed";
if (! -d $deployedDir) {
	print "Creating $deployedDir\n";
	mkdir($deployedDir);
}

my $deployed = $deployedDir . "/mtd-$ts.tgz";
my $baseDir = $DIR . "/../";

my $cmd = qq(/bin/tar cvzXf $xclude $deployed -C $baseDir server lib pm2 scripts);
print $cmd,"\n";
system($cmd);

print "Deployed file is",$deployed,"\n";
